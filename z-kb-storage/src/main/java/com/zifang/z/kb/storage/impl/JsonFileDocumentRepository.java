package com.zifang.z.kb.storage.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.Document;
import com.zifang.z.kb.api.DocumentRepository;
import com.zifang.z.kb.api.DocumentStatus;
import com.zifang.z.kb.api.Workspace;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.ReentrantLock;

/**
 * JSON 文件持久化版 DocumentRepository — 解决内存版重启丢数据的痛点。
 *
 * <p>所有变更同步落盘到 {@code zkb.json}，启动时自动加载。
 * <p>默认路径：{@code ~/.zkb/zkb.json}，可通过 {@code zkb.storage.path} 配置覆盖。
 *
 * <p>适用场景：单实例 demo / 开发 / 嵌入式部署。
 * <p>生产多实例场景建议替换为基于 MySQL/MyBatis-Plus 的实现（见 storage 模块 entity/mapper 包）。
 */
public class JsonFileDocumentRepository implements DocumentRepository {

    private static final Logger log = LoggerFactory.getLogger(JsonFileDocumentRepository.class);
    private static final String DEFAULT_PATH = System.getProperty("user.home") + "/.zkb/zkb.json";

    /** workspace → documentId → Document */
    private final ConcurrentHashMap<String, ConcurrentHashMap<String, Document>> docs =
            new ConcurrentHashMap<>();
    /** workspace → chunkId → Chunk */
    private final ConcurrentHashMap<String, ConcurrentHashMap<String, Chunk>> chunks =
            new ConcurrentHashMap<>();
    /** workspace → path → documentId（用于去重导入） */
    private final ConcurrentHashMap<String, ConcurrentHashMap<String, String>> pathIndex =
            new ConcurrentHashMap<>();
    /** workspaceId → Workspace */
    private final ConcurrentHashMap<String, Workspace> workspaces = new ConcurrentHashMap<>();

    private final Path storePath;
    private final ObjectMapper mapper;
    private final ReentrantLock writeLock = new ReentrantLock();
    private final AtomicBoolean dirty = new AtomicBoolean(false);

    /**
     * 单线程池 — 避免每次 save 都新建线程把 OS 线程数撑爆。
     * 每 200ms 检查一次 dirty 标记，如有变更就同步落盘。
     */
    private final ScheduledExecutorService persistExecutor;

    public JsonFileDocumentRepository() {
        this(DEFAULT_PATH);
    }

    public JsonFileDocumentRepository(String pathStr) {
        this.storePath = Paths.get(pathStr);
        this.mapper = new ObjectMapper()
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        // 如果 classpath 里有 jsr310 模块则启用（支持 Instant）
        try {
            Class<?> moduleClass = Class.forName("com.fasterxml.jackson.datatype.jsr310.JavaTimeModule");
            Object module = moduleClass.getDeclaredConstructor().newInstance();
            mapper.registerModule((com.fasterxml.jackson.databind.Module) module);
        } catch (Throwable t) {
            // Instant 会序列化为 epoch-long — 启动能跑即可
        }
        try {
            if (Files.exists(storePath)) {
                load();
                log.info("已从 {} 加载持久化数据：workspace={}, docs={}, chunks={}",
                        storePath, workspaces.size(), totalDocs(), totalChunks());
            } else {
                // 默认工作台
                Workspace defaultWs = new Workspace("default");
                defaultWs.setDescription("默认工作台");
                workspaces.put(defaultWs.getId(), defaultWs);
                persist();
                log.info("已初始化空存储：{}", storePath);
            }
        } catch (Exception e) {
            log.error("持久化存储初始化失败，使用空内存：{}", e.getMessage(), e);
            // fallback：建一个默认工作台
            Workspace defaultWs = new Workspace("default");
            defaultWs.setDescription("默认工作台");
            workspaces.put(defaultWs.getId(), defaultWs);
        }
        // 单线程池，定期扫描 dirty 标记并落盘（合并写）
        this.persistExecutor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "zkb-doc-persist");
            t.setDaemon(true);
            return t;
        });
        this.persistExecutor.scheduleWithFixedDelay(() -> {
            if (dirty.compareAndSet(true, false)) persist();
        }, 200, 200, TimeUnit.MILLISECONDS);
    }

    // ==================== Document ====================

    @Override
    public Document save(Document doc) {
        if (doc == null) return null;
        if (doc.getStatus() == null) doc.setStatus(DocumentStatus.CREATED);
        docs.computeIfAbsent(doc.getWorkspace(), k -> new ConcurrentHashMap<>()).put(doc.getId(), doc);
        if (doc.getPath() != null && !doc.getPath().isEmpty()) {
            pathIndex.computeIfAbsent(doc.getWorkspace(), k -> new ConcurrentHashMap<>()).put(doc.getPath(), doc.getId());
        }
        persistAsync();
        return doc;
    }

    @Override
    public Document findById(String workspace, String id) {
        ConcurrentHashMap<String, Document> map = docs.get(workspace);
        return map == null ? null : map.get(id);
    }

    @Override
    public Document findByPath(String workspace, String path) {
        ConcurrentHashMap<String, String> pIdx = pathIndex.get(workspace);
        if (pIdx == null) return null;
        String id = pIdx.get(path);
        return id == null ? null : findById(workspace, id);
    }

    @Override
    public List<Document> listByWorkspace(String workspace, int offset, int limit) {
        ConcurrentHashMap<String, Document> map = docs.get(workspace);
        if (map == null) return Collections.emptyList();
        List<Document> all = new ArrayList<>(map.values());
        all.sort(Comparator.comparing(Document::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return paginate(all, offset, limit);
    }

    @Override
    public List<Document> listByTags(String workspace, List<String> tags, int offset, int limit) {
        ConcurrentHashMap<String, Document> map = docs.get(workspace);
        if (map == null) return Collections.emptyList();
        List<Document> all = new ArrayList<>();
        for (Document d : map.values()) {
            if (d.getTags() == null) continue;
            if (tags.stream().anyMatch(t -> d.getTags().contains(t))) all.add(d);
        }
        all.sort(Comparator.comparing(Document::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return paginate(all, offset, limit);
    }

    @Override
    public long countByWorkspace(String workspace) {
        ConcurrentHashMap<String, Document> map = docs.get(workspace);
        return map == null ? 0 : map.size();
    }

    @Override
    public boolean softDelete(String workspace, String id) {
        Document d = findById(workspace, id);
        if (d == null) return false;
        d.setStatus(DocumentStatus.DELETED);
        persistAsync();
        return true;
    }

    @Override
    public boolean hardDelete(String workspace, String id) {
        ConcurrentHashMap<String, Document> map = docs.get(workspace);
        if (map == null) return false;
        Document removed = map.remove(id);
        if (removed != null && removed.getPath() != null) {
            ConcurrentHashMap<String, String> pIdx = pathIndex.get(workspace);
            if (pIdx != null) pIdx.remove(removed.getPath());
        }
        if (removed != null) deleteChunksByDocument(workspace, id);
        persistAsync();
        return removed != null;
    }

    @Override
    public List<Document> findByIds(String workspace, List<String> ids) {
        List<Document> result = new ArrayList<>();
        if (ids == null) return result;
        for (String id : ids) {
            Document d = findById(workspace, id);
            if (d != null) result.add(d);
        }
        return result;
    }

    @Override
    public List<Document> searchByTitle(String workspace, String keyword, int limit) {
        if (keyword == null || keyword.isEmpty()) return Collections.emptyList();
        ConcurrentHashMap<String, Document> map = docs.get(workspace);
        if (map == null) return Collections.emptyList();
        String lower = keyword.toLowerCase();
        List<Document> result = new ArrayList<>();
        for (Document d : map.values()) {
            if (d.getStatus() == DocumentStatus.DELETED) continue;
            if ((d.getTitle() != null && d.getTitle().toLowerCase().contains(lower)) ||
                (d.getPath() != null && d.getPath().toLowerCase().contains(lower))) {
                result.add(d);
                if (result.size() >= limit) break;
            }
        }
        return result;
    }

    // ==================== Chunk ====================

    @Override
    public Chunk saveChunk(Chunk chunk) {
        if (chunk == null) return null;
        chunks.computeIfAbsent(chunk.getWorkspace(), k -> new ConcurrentHashMap<>()).put(chunk.getId(), chunk);
        persistAsync();
        return chunk;
    }

    @Override
    public List<Chunk> saveChunks(List<Chunk> chunkList) {
        if (chunkList == null) return Collections.emptyList();
        for (Chunk c : chunkList) saveChunk(c);
        return chunkList;
    }

    @Override
    public List<Chunk> findChunksByDocument(String workspace, String documentId) {
        ConcurrentHashMap<String, Chunk> map = chunks.get(workspace);
        if (map == null) return Collections.emptyList();
        List<Chunk> result = new ArrayList<>();
        for (Chunk c : map.values()) {
            if (documentId.equals(c.getDocumentId())) result.add(c);
        }
        result.sort(Comparator.comparingInt(Chunk::getOrdinal));
        return result;
    }

    @Override
    public Chunk findChunkById(String workspace, String id) {
        ConcurrentHashMap<String, Chunk> map = chunks.get(workspace);
        return map == null ? null : map.get(id);
    }

    @Override
    public List<Chunk> findChunksByIds(String workspace, List<String> ids) {
        List<Chunk> result = new ArrayList<>();
        if (ids == null) return result;
        for (String id : ids) {
            Chunk c = findChunkById(workspace, id);
            if (c != null) result.add(c);
        }
        return result;
    }

    @Override
    public int deleteChunksByDocument(String workspace, String documentId) {
        ConcurrentHashMap<String, Chunk> map = chunks.get(workspace);
        if (map == null) return 0;
        int deleted = 0;
        Iterator<Chunk> it = map.values().iterator();
        while (it.hasNext()) {
            if (documentId.equals(it.next().getDocumentId())) {
                it.remove();
                deleted++;
            }
        }
        if (deleted > 0) persistAsync();
        return deleted;
    }

    // ==================== Workspace ====================

    @Override
    public Workspace createWorkspace(Workspace workspace) {
        if (workspace.getId() == null) workspace.setId(UUID.randomUUID().toString());
        workspaces.put(workspace.getId(), workspace);
        persistAsync();
        return workspace;
    }

    @Override
    public Workspace getWorkspace(String id) {
        return workspaces.get(id);
    }

    @Override
    public Workspace getWorkspaceByName(String name) {
        if (name == null) return null;
        for (Workspace w : workspaces.values()) if (name.equals(w.getName())) return w;
        return null;
    }

    @Override
    public List<Workspace> listWorkspaces() {
        return new ArrayList<>(workspaces.values());
    }

    // ==================== 持久化 ====================

    private void markDirty() {
        dirty.set(true);
    }

    private void persistAsync() {
        markDirty();
    }

    private void persist() {
        writeLock.lock();
        try {
            Files.createDirectories(storePath.getParent());
            Map<String, Object> dump = new LinkedHashMap<>();
            dump.put("docs", docs);
            dump.put("chunks", chunks);
            dump.put("workspaces", workspaces);
            String json = mapper.writeValueAsString(dump);
            Path tmp = storePath.resolveSibling(storePath.getFileName() + ".tmp");
            Files.writeString(tmp, json, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            Files.move(tmp, storePath, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            log.error("持久化失败：{}", e.getMessage());
        } finally {
            writeLock.unlock();
        }
    }

    @SuppressWarnings("unchecked")
    private void load() throws IOException {
        // 用 TypeReference 让 Jackson 正确还原 Document/Chunk/Workspace 泛型
        TypeReference<Map<String, Map<String, Document>>> docType =
                new TypeReference<Map<String, Map<String, Document>>>() {};
        TypeReference<Map<String, Map<String, Chunk>>> chunkType =
                new TypeReference<Map<String, Map<String, Chunk>>>() {};
        TypeReference<Map<String, Workspace>> wsType =
                new TypeReference<Map<String, Workspace>>() {};

        Map<String, Object> dump = mapper.readValue(Files.readAllBytes(storePath), new TypeReference<Map<String, Object>>() {});

        if (dump.containsKey("docs")) {
            Map<String, Map<String, Document>> d = mapper.convertValue(dump.get("docs"), docType);
            d.forEach((ws, m) -> docs.put(ws, new ConcurrentHashMap<>(m)));
        }
        if (dump.containsKey("chunks")) {
            Map<String, Map<String, Chunk>> c = mapper.convertValue(dump.get("chunks"), chunkType);
            c.forEach((ws, m) -> chunks.put(ws, new ConcurrentHashMap<>(m)));
        }
        if (dump.containsKey("workspaces")) {
            Map<String, Workspace> w = mapper.convertValue(dump.get("workspaces"), wsType);
            workspaces.putAll(w);
        }
        // 重建 pathIndex
        for (ConcurrentHashMap<String, Document> m : docs.values()) {
            for (Document d : m.values()) {
                if (d.getPath() != null && !d.getPath().isEmpty()) {
                    pathIndex.computeIfAbsent(d.getWorkspace(), k -> new ConcurrentHashMap<>()).put(d.getPath(), d.getId());
                }
            }
        }
    }

    private long totalDocs() {
        long total = 0;
        for (ConcurrentHashMap<String, Document> m : docs.values()) total += m.size();
        return total;
    }

    private long totalChunks() {
        long total = 0;
        for (ConcurrentHashMap<String, Chunk> m : chunks.values()) total += m.size();
        return total;
    }

    private <T> List<T> paginate(List<T> list, int offset, int limit) {
        if (offset >= list.size()) return Collections.emptyList();
        int from = Math.max(0, offset);
        int to = Math.min(list.size(), from + Math.max(1, limit));
        return list.subList(from, to);
    }
}