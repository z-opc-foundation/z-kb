package com.zifang.z.kb.graph.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.zifang.z.kb.api.Entity;
import com.zifang.z.kb.api.EntityType;
import com.zifang.z.kb.api.GraphQueryResult;
import com.zifang.z.kb.api.KnowledgeGraphStore;
import com.zifang.z.kb.api.Relation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

/**
 * z-kb 图谱 JSON 文件持久化 — 重启不丢实体/关系。
 *
 * <p>每个 workspace 一份 JSON：
 * <ul>
 *   <li>{@code workspaceId} → {@link GraphData}（entities + relations + id 映射）</li>
 *   <li>默认目录：{@code ~/.zkb/graph/}（与 {@code zkb.graph.path} 共享 home）</li>
 * </ul>
 *
 * <p>特点：
 * <ul>
 *   <li>扁平 JSON，可人工 cat 查看</li>
 *   <li>异步落盘，WAL  写锁防并发写</li>
 *   <li>支持通过 {@code zkb.graph.path} 自定义目录</li>
 * </ul>
 */
public class JsonFileKnowledgeGraphStore implements KnowledgeGraphStore {

    private static final Logger log = LoggerFactory.getLogger(JsonFileKnowledgeGraphStore.class);
    private static final String DEFAULT_DIR = System.getProperty("user.home") + "/.zkb/graph";

    private final Path baseDir;
    private final ObjectMapper mapper;
    private final ReentrantLock writeLock = new ReentrantLock();

    /** workspace → GraphData */
    private final ConcurrentHashMap<String, GraphData> workspaces = new ConcurrentHashMap<>();

    /** workspace → dirty flag（被修改过待落盘） */
    private final ConcurrentHashMap<String, Boolean> dirty = new ConcurrentHashMap<>();

    /**
     * 单一持久化线程池 — 避免每条 entity 都新建线程把 OS 线程数撑爆。
     * 1 个常驻线程 + 合并写：每 200ms 检查 dirty workspace，做一次落盘。
     */
    private final ScheduledExecutorService persistExecutor;

    public JsonFileKnowledgeGraphStore() {
        this(DEFAULT_DIR);
    }

    public JsonFileKnowledgeGraphStore(String dirPath) {
        this.baseDir = Paths.get(dirPath);
        this.mapper = new ObjectMapper();
        // 优先尝试加载 jsr310 模块（支持 Instant）
        try {
            Class<?> moduleClass = Class.forName("com.fasterxml.jackson.datatype.jsr310.JavaTimeModule");
            Object module = moduleClass.getDeclaredConstructor().newInstance();
            mapper.registerModule((com.fasterxml.jackson.databind.Module) module);
            mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        } catch (Throwable t) {
            // Instant 序列化为 epoch-long 也可工作
        }
        try {
            Files.createDirectories(baseDir);
            int loaded = load();
            log.info("已从 {} 加载 {} 个 workspace 的图谱数据", baseDir, loaded);
        } catch (IOException e) {
            log.error("图谱存储初始化失败：{}", e.getMessage());
        }
        // 单线程池，定期扫描 dirty workspace 并落盘
        this.persistExecutor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "zkb-graph-persist");
            t.setDaemon(true);
            return t;
        });
        this.persistExecutor.scheduleWithFixedDelay(this::persistDirty, 200, 200, TimeUnit.MILLISECONDS);
    }

    /** 加载所有 workspace 文件到内存 */
    private int load() throws IOException {
        if (!Files.exists(baseDir)) return 0;
        int count = 0;
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(baseDir, "*.json")) {
            for (Path p : stream) {
                try {
                    GraphData data = mapper.readValue(Files.readAllBytes(p), GraphData.class);
                    if (data.workspace != null) {
                        workspaces.put(data.workspace, data);
                        count++;
                    }
                } catch (Exception e) {
                    log.warn("加载图谱文件 {} 失败：{}", p, e.getMessage());
                }
            }
        }
        return count;
    }

    /** 获取或创建 workspace 的图数据 */
    private GraphData dataFor(String workspace) {
        return workspaces.computeIfAbsent(workspace, k -> new GraphData(k));
    }

    /** 标记 workspace 为脏（待落盘），由后台线程定期刷盘 */
    private void markDirty(String workspace) {
        if (workspace != null) dirty.put(workspace, Boolean.TRUE);
    }

    /** 后台线程周期调用：扫描所有 dirty workspace，落盘后清标 */
    private void persistDirty() {
        for (String ws : new ArrayList<>(dirty.keySet())) {
            if (!dirty.remove(ws)) continue;
            GraphData data = workspaces.get(ws);
            if (data != null) persist(ws, data);
        }
    }

    private void persist(String workspace, GraphData data) {
        writeLock.lock();
        try {
            // 拷贝快照，避免在序列化时其他线程修改 entities/relations 触发 CME
            GraphData snapshot = new GraphData(data.workspace);
            snapshot.nextEntityId = data.nextEntityId;
            snapshot.nextRelationId = data.nextRelationId;
            snapshot.entities = new LinkedHashMap<>(data.entities);
            snapshot.relations = new ArrayList<>(data.relations);
            String json = mapper.writeValueAsString(snapshot);
            Path file = baseDir.resolve(safeName(workspace) + ".json");
            Path tmp = file.resolveSibling(file.getFileName() + ".tmp");
            Files.writeString(tmp, json, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            log.error("图谱持久化失败 workspace={} : {}", workspace, e.getMessage());
        } finally {
            writeLock.unlock();
        }
    }

    private static String safeName(String s) {
        return s.replaceAll("[^a-zA-Z0-9_-]", "_");
    }

    // ==================== Entity ====================

    @Override
    public synchronized Entity upsertEntity(Entity entity) {
        if (entity == null) return null;
        GraphData data = dataFor(entity.getWorkspace());
        long id = data.nextEntityId++;
        entity.setId(String.valueOf(id));
        // 用 canonicalName 去重
        data.entities.put(entity.getCanonicalName(), entity);
        markDirty(entity.getWorkspace());
        return entity;
    }

    @Override
    public synchronized List<Entity> upsertEntities(List<Entity> entities) {
        if (entities == null) return Collections.emptyList();
        if (entities.isEmpty()) return entities;
        String ws = entities.get(0).getWorkspace();
        GraphData data = dataFor(ws);
        for (Entity e : entities) {
            long id = data.nextEntityId++;
            e.setId(String.valueOf(id));
            data.entities.put(e.getCanonicalName(), e);
        }
        markDirty(ws);
        return entities;
    }

    @Override
    public Entity findEntity(String workspace, String canonicalName) {
        if (canonicalName == null) return null;
        GraphData data = workspaces.get(workspace);
        return data == null ? null : data.entities.get(canonicalName);
    }

    @Override
    public Entity getEntity(String workspace, String id) {
        if (id == null) return null;
        GraphData data = workspaces.get(workspace);
        if (data == null) return null;
        for (Entity e : data.entities.values()) {
            if (id.equals(e.getId())) return e;
        }
        return null;
    }

    @Override
    public List<Entity> searchEntities(String workspace, String keyword, int limit) {
        if (keyword == null || keyword.isEmpty()) return Collections.emptyList();
        GraphData data = workspaces.get(workspace);
        if (data == null) return Collections.emptyList();
        String lower = keyword.toLowerCase();
        List<Entity> out = new ArrayList<>();
        for (Entity e : data.entities.values()) {
            String n = e.getCanonicalName();
            if (n != null && n.toLowerCase().contains(lower)) {
                out.add(e);
                if (out.size() >= limit) break;
            }
        }
        return out;
    }

    @Override
    public List<Entity> listEntitiesByType(String workspace, EntityType type, int limit) {
        GraphData data = workspaces.get(workspace);
        if (data == null) return Collections.emptyList();
        List<Entity> out = new ArrayList<>();
        for (Entity e : data.entities.values()) {
            if (e.getType() == type) {
                out.add(e);
                if (out.size() >= limit) break;
            }
        }
        return out;
    }

    @Override
    public List<Entity> listAllEntities(String workspace, int limit) {
        GraphData data = workspaces.get(workspace);
        if (data == null) return Collections.emptyList();
        List<Entity> out = new ArrayList<>(data.entities.values());
        if (out.size() > limit) return out.subList(0, limit);
        return out;
    }

    // ==================== Relation ====================

    @Override
    public synchronized Relation upsertRelation(Relation relation) {
        if (relation == null) return null;
        GraphData data = dataFor(relation.getWorkspace());
        relation.setId(String.valueOf(data.nextRelationId++));
        data.relations.add(relation);
        markDirty(relation.getWorkspace());
        return relation;
    }

    @Override
    public synchronized List<Relation> upsertRelations(List<Relation> relations) {
        if (relations == null) return Collections.emptyList();
        if (relations.isEmpty()) return relations;
        String ws = relations.get(0).getWorkspace();
        GraphData data = dataFor(ws);
        for (Relation r : relations) {
            r.setId(String.valueOf(data.nextRelationId++));
            data.relations.add(r);
        }
        markDirty(ws);
        return relations;
    }

    @Override
    public List<Relation> getOutRelations(String workspace, String entityName) {
        GraphData data = workspaces.get(workspace);
        if (data == null) return Collections.emptyList();
        List<Relation> out = new ArrayList<>();
        for (Relation r : data.relations) {
            if (entityName.equals(r.getSourceEntityName())) out.add(r);
        }
        return out;
    }

    @Override
    public List<Relation> getInRelations(String workspace, String entityName) {
        GraphData data = workspaces.get(workspace);
        if (data == null) return Collections.emptyList();
        List<Relation> out = new ArrayList<>();
        for (Relation r : data.relations) {
            if (entityName.equals(r.getTargetEntityName())) out.add(r);
        }
        return out;
    }

    @Override
    public Set<Entity> traverse(String workspace, String entityName, int maxDepth) {
        Set<Entity> result = new HashSet<>();
        GraphData data = workspaces.get(workspace);
        if (data == null || maxDepth <= 0) return result;
        Set<String> visited = new HashSet<>();
        Deque<String> queue = new ArrayDeque<>();
        queue.add(entityName);
        visited.add(entityName);

        for (int d = 0; d < maxDepth && !queue.isEmpty(); d++) {
            int levelSize = queue.size();
            for (int i = 0; i < levelSize; i++) {
                String cur = queue.poll();
                Entity curEnt = data.entities.get(cur);
                if (curEnt != null) result.add(curEnt);
                for (Relation r : data.relations) {
                    String next = null;
                    if (cur.equals(r.getSourceEntityName())) next = r.getTargetEntityName();
                    else if (cur.equals(r.getTargetEntityName())) next = r.getSourceEntityName();
                    if (next != null && visited.add(next)) queue.add(next);
                }
            }
        }
        return result;
    }

    @Override
    public GraphQueryResult subgraph(String workspace, List<String> entityNames, int depth) {
        GraphQueryResult out = new GraphQueryResult();
        GraphData data = workspaces.get(workspace);
        if (data == null) return out;
        Set<String> visited = new HashSet<>(entityNames);
        Deque<String> queue = new ArrayDeque<>(entityNames);
        List<Entity> nodes = new ArrayList<>();
        for (int d = 0; d <= depth && !queue.isEmpty(); d++) {
            int levelSize = queue.size();
            for (int i = 0; i < levelSize; i++) {
                String cur = queue.poll();
                Entity ent = data.entities.get(cur);
                if (ent != null) nodes.add(ent);
                for (Relation r : data.relations) {
                    if (cur.equals(r.getSourceEntityName()) && visited.add(r.getTargetEntityName())) {
                        queue.add(r.getTargetEntityName());
                    } else if (cur.equals(r.getTargetEntityName()) && visited.add(r.getSourceEntityName())) {
                        queue.add(r.getSourceEntityName());
                    }
                }
            }
        }
        out.setNodes(nodes);
        Set<String> names = new HashSet<>();
        for (Entity n : nodes) if (n.getCanonicalName() != null) names.add(n.getCanonicalName());
        List<Relation> edges = new ArrayList<>();
        for (Relation r : data.relations) {
            if (names.contains(r.getSourceEntityName()) && names.contains(r.getTargetEntityName())) {
                edges.add(r);
            }
        }
        out.setEdges(edges);
        return out;
    }

    @Override
    public synchronized boolean deleteEntity(String workspace, String entityName) {
        GraphData data = workspaces.get(workspace);
        if (data == null) return false;
        Entity removed = data.entities.remove(entityName);
        if (removed == null) return false;
        // 联动删边
        data.relations.removeIf(r -> entityName.equals(r.getSourceEntityName()) || entityName.equals(r.getTargetEntityName()));
        markDirty(workspace);
        return true;
    }

    @Override
    public synchronized int deleteByDocument(String workspace, String documentId) {
        GraphData data = workspaces.get(workspace);
        if (data == null) return 0;
        int before = data.entities.size() + data.relations.size();
        // 删除该文档的实体（含从 sourceChunkIds 判断）
        data.entities.entrySet().removeIf(e -> {
            List<String> src = e.getValue().getSourceChunkIds();
            // Entity 没 documentId 字段，但 sourceChunkIds 是 chunk ids；
            // 这里用 chunkId 前缀（documentId_xxx）来匹配。简单起见，也允许 entity.id == documentId
            return src != null && src.stream().anyMatch(id -> id.startsWith(documentId + "_"))
                || documentId.equals(e.getValue().getId());
        });
        // 删除相关边（evidenceChunkIds 中含该 documentId）
        data.relations.removeIf(r -> {
            List<String> ev = r.getEvidenceChunkIds();
            return ev != null && ev.stream().anyMatch(id -> id.startsWith(documentId + "_"));
        });
        int after = data.entities.size() + data.relations.size();
        int removed = before - after;
        if (removed > 0) markDirty(workspace);
        return removed;
    }

    @Override
    public synchronized Map<String, Long> stats(String workspace) {
        GraphData data = workspaces.get(workspace);
        Map<String, Long> out = new LinkedHashMap<>();
        if (data == null) {
            out.put("nodes", 0L);
            out.put("edges", 0L);
        } else {
            out.put("nodes", (long) data.entities.size());
            out.put("edges", (long) data.relations.size());
        }
        return out;
    }

    @Override
    public void close() {
        // 停止后台线程，最后一次全量同步落盘
        if (persistExecutor != null) persistExecutor.shutdown();
        for (Map.Entry<String, GraphData> e : workspaces.entrySet()) {
            persist(e.getKey(), e.getValue());
        }
    }

    /** 图谱持久化数据结构（每个 workspace 一份 JSON）） */
    public static class GraphData {
        public String workspace;
        public long nextEntityId = 1;
        public long nextRelationId = 1;
        /** canonicalName → Entity */
        public Map<String, Entity> entities = new LinkedHashMap<>();
        /** 关系列表 */
        public List<Relation> relations = new ArrayList<>();

        public GraphData() {}
        public GraphData(String workspace) { this.workspace = workspace; }
    }
}