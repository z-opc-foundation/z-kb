package com.zifang.z.kb.core.eval;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.ChunkVectorStore;
import com.zifang.z.kb.api.Entity;
import com.zifang.z.kb.api.EntityType;
import com.zifang.z.kb.api.GraphQueryResult;
import com.zifang.z.kb.api.KnowledgeGraphStore;
import com.zifang.z.kb.api.Relation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 评测用的内存替身 — 精确复刻 {@code JsonFileKnowledgeGraphStore.searchEntities} 的
 * {@code canonicalName.contains(keyword)} 匹配语义，以及 {@code ZVectorChunkVectorStore}
 * 的 {@code kb_<workspace>_<collection>} 物理命名。
 *
 * <p>物理命名必须照抄：写入侧与检索侧一旦用不同字面量，真实环境下表现为向量路静默恒空，
 * 而任何简化命名的替身都会把这类 bug 掩盖成「一切正常」。
 */
class InMemoryStores {

    private InMemoryStores() {
    }

    static class Vector implements ChunkVectorStore {

        private final Map<String, Map<String, Chunk>> byCollection = new HashMap<>();
        private final Map<String, Integer> dims = new HashMap<>();
        /** 记录每一次 hasCollection 的物理名，测试可断言写入侧与检索侧用的是同一个 */
        final List<String> probedCollections = new ArrayList<>();

        private String physical(String workspace, String collection) {
            return "kb_" + workspace + "_" + collection;
        }

        @Override
        public void createCollection(String workspace, String collectionName, int dimension) {
            String key = physical(workspace, collectionName);
            byCollection.computeIfAbsent(key, k -> new LinkedHashMap<>());
            dims.put(key, dimension);
        }

        @Override
        public boolean hasCollection(String workspace, String collectionName) {
            String key = physical(workspace, collectionName);
            probedCollections.add(key);
            return dims.containsKey(key);
        }

        @Override
        public boolean deleteCollection(String workspace, String collectionName) {
            String key = physical(workspace, collectionName);
            dims.remove(key);
            byCollection.remove(key);
            return true;
        }

        @Override
        public void upsert(String workspace, String collectionName, List<Chunk> chunks) {
            String key = physical(workspace, collectionName);
            Map<String, Chunk> store = byCollection.computeIfAbsent(key, k -> new LinkedHashMap<>());
            for (Chunk c : chunks) {
                store.put(c.getId(), c);
            }
            dims.putIfAbsent(key, chunks.isEmpty() || chunks.get(0).getEmbedding() == null
                    ? 0 : chunks.get(0).getEmbedding().length);
        }

        @Override
        public List<VectorMatch> search(String workspace, String collectionName, float[] queryVector,
                                        int topK, Map<String, Object> filter) {
            Map<String, Chunk> store = byCollection.get(physical(workspace, collectionName));
            if (store == null || queryVector == null) {
                return Collections.emptyList();
            }
            List<VectorMatch> matches = new ArrayList<>();
            for (Chunk c : store.values()) {
                float score = cosine(queryVector, c.getEmbedding());
                matches.add(new VectorMatch(c.getId(), c.getDocumentId(), score, new HashMap<>()));
            }
            matches.sort(Comparator.comparingDouble((VectorMatch m) -> m.score).reversed());
            return matches.size() > topK ? matches.subList(0, topK) : matches;
        }

        @Override
        public boolean delete(String workspace, String collectionName, String chunkId) {
            Map<String, Chunk> store = byCollection.get(physical(workspace, collectionName));
            return store != null && store.remove(chunkId) != null;
        }

        @Override
        public int deleteByDocument(String workspace, String collectionName, String documentId) {
            Map<String, Chunk> store = byCollection.get(physical(workspace, collectionName));
            if (store == null) return 0;
            Set<String> doomed = new HashSet<>();
            for (Chunk c : store.values()) {
                if (documentId.equals(c.getDocumentId())) doomed.add(c.getId());
            }
            for (String id : doomed) store.remove(id);
            return doomed.size();
        }

        @Override
        public long count(String workspace, String collectionName) {
            Map<String, Chunk> store = byCollection.get(physical(workspace, collectionName));
            return store == null ? 0 : store.size();
        }

        @Override
        public void close() {
        }

        private static float cosine(float[] a, float[] b) {
            if (a == null || b == null || a.length != b.length) return 0f;
            double dot = 0, na = 0, nb = 0;
            for (int i = 0; i < a.length; i++) {
                dot += a[i] * b[i];
                na += a[i] * a[i];
                nb += b[i] * b[i];
            }
            if (na == 0 || nb == 0) return 0f;
            return (float) (dot / (Math.sqrt(na) * Math.sqrt(nb)));
        }
    }

    static class Graph implements KnowledgeGraphStore {

        private final Map<String, Entity> entities = new LinkedHashMap<>();

        @Override
        public Entity upsertEntity(Entity entity) {
            entities.put(key(entity.getWorkspace(), entity.getCanonicalName()), entity);
            return entity;
        }

        @Override
        public List<Entity> upsertEntities(List<Entity> list) {
            for (Entity e : list) upsertEntity(e);
            return list;
        }

        @Override
        public Entity findEntity(String workspace, String canonicalName) {
            return entities.get(key(workspace, canonicalName));
        }

        @Override
        public Entity getEntity(String workspace, String id) {
            return findEntity(workspace, id);
        }

        /** 与生产实现同语义：canonicalName.contains(keyword)，整句 query 因此永远匹配不到 */
        @Override
        public List<Entity> searchEntities(String workspace, String keyword, int limit) {
            List<Entity> out = new ArrayList<>();
            if (keyword == null) return out;
            String lower = keyword.toLowerCase(Locale.ROOT);
            for (Entity e : entities.values()) {
                if (workspace != null && !workspace.equals(e.getWorkspace())) continue;
                if (e.getCanonicalName() != null && e.getCanonicalName().toLowerCase(Locale.ROOT).contains(lower)) {
                    out.add(e);
                    if (out.size() >= limit) break;
                }
            }
            return out;
        }

        @Override
        public List<Entity> listEntitiesByType(String workspace, EntityType type, int limit) {
            List<Entity> out = new ArrayList<>();
            for (Entity e : entities.values()) {
                if (type == e.getType()) out.add(e);
            }
            return out.size() > limit ? out.subList(0, limit) : out;
        }

        @Override
        public List<Entity> listAllEntities(String workspace, int limit) {
            List<Entity> out = new ArrayList<>();
            for (Entity e : entities.values()) out.add(e);
            return out.size() > limit ? out.subList(0, limit) : out;
        }

        @Override
        public Relation upsertRelation(Relation relation) { return relation; }

        @Override
        public List<Relation> upsertRelations(List<Relation> list) { return list; }

        @Override
        public List<Relation> getOutRelations(String workspace, String entityName) { return new ArrayList<>(); }

        @Override
        public List<Relation> getInRelations(String workspace, String entityName) { return new ArrayList<>(); }

        @Override
        public Set<Entity> traverse(String workspace, String entityName, int maxDepth) { return new HashSet<>(); }

        @Override
        public GraphQueryResult subgraph(String workspace, List<String> entityNames, int depth) { return null; }

        @Override
        public boolean deleteEntity(String workspace, String entityName) {
            return entities.remove(key(workspace, entityName)) != null;
        }

        @Override
        public int deleteByDocument(String workspace, String documentId) {
            int n = 0;
            for (Map.Entry<String, Entity> e : new ArrayList<>(entities.entrySet())) {
                if (entityDocumentIds(e.getValue()).contains(documentId)) {
                    entities.remove(e.getKey());
                    n++;
                }
            }
            return n;
        }

        @Override
        public Map<String, Long> stats(String workspace) { return new HashMap<>(); }

        @Override
        public void close() {
        }

        private static Set<String> entityDocumentIds(Entity e) {
            return e.getSourceDocumentIds() == null ? new HashSet<String>() : new HashSet<>(e.getSourceDocumentIds());
        }

        private static String key(String workspace, String name) {
            return workspace + "::" + name;
        }
    }
}
