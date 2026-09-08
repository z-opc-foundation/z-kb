package com.zifang.z.kb.graph.impl;

import com.zifang.z.graph.api.Edge;
import com.zifang.z.graph.api.GraphStore;
import com.zifang.z.graph.api.Node;
import com.zifang.z.kb.api.Entity;
import com.zifang.z.kb.api.EntityType;
import com.zifang.z.kb.api.GraphQueryResult;
import com.zifang.z.kb.api.KnowledgeGraphStore;
import com.zifang.z.kb.api.Relation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 基于 z-graph 的 KnowledgeGraphStore 实现 — 适配器模式。
 *
 * <p>每个 workspace 维护独立的 GraphStore 实例。
 */
public class ZGraphKnowledgeGraphStore implements KnowledgeGraphStore {

    private static final Logger log = LoggerFactory.getLogger(ZGraphKnowledgeGraphStore.class);

    private final Map<String, GraphStore> workspaceStores = new ConcurrentHashMap<>();
    /** workspace → canonicalName → nodeId */
    private final Map<String, Map<String, Long>> entityNameIndex = new ConcurrentHashMap<>();

    private GraphStore storeFor(String workspace) {
        return workspaceStores.computeIfAbsent(workspace, k -> {
            try {
                Class<?> clazz = Class.forName("com.zifang.z.graph.core.InMemoryGraphStore");
                return (GraphStore) clazz.getDeclaredConstructor().newInstance();
            } catch (Exception e) {
                throw new RuntimeException("Failed to create graph store", e);
            }
        });
    }

    private long upsertEntityNode(String workspace, String canonicalName, EntityType type) {
        GraphStore store = storeFor(workspace);
        Map<String, Long> index = entityNameIndex.computeIfAbsent(workspace, k -> new ConcurrentHashMap<>());
        Long existingId = index.get(canonicalName);
        if (existingId != null) {
            Node existing = store.getNode(existingId);
            if (existing != null) return existingId;
        }
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("name", canonicalName);
        props.put("type", type.name());
        Node node = store.addNode(canonicalName, props);
        index.put(canonicalName, node.getId());
        return node.getId();
    }

    @Override
    public Entity upsertEntity(Entity entity) {
        if (entity == null || entity.getCanonicalName() == null) return null;
        upsertEntityNode(entity.getWorkspace(), entity.getCanonicalName(), entity.getType());
        return entity;
    }

    @Override
    public List<Entity> upsertEntities(List<Entity> entities) {
        if (entities == null) return new ArrayList<>();
        for (Entity e : entities) upsertEntity(e);
        return entities;
    }

    @Override
    public Entity findEntity(String workspace, String canonicalName) {
        Map<String, Long> index = entityNameIndex.get(workspace);
        if (index == null) return null;
        Long id = index.get(canonicalName);
        if (id == null) return null;
        GraphStore store = storeFor(workspace);
        Node node = store.getNode(id);
        if (node == null) return null;
        return nodeToEntity(node, workspace);
    }

    @Override
    public Entity getEntity(String workspace, String id) {
        try {
            GraphStore store = storeFor(workspace);
            Node node = store.getNode(Long.parseLong(id));
            return node == null ? null : nodeToEntity(node, workspace);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    @Override
    public List<Entity> searchEntities(String workspace, String keyword, int limit) {
        List<Entity> result = new ArrayList<>();
        if (keyword == null || keyword.isEmpty()) return result;
        Map<String, Long> index = entityNameIndex.get(workspace);
        if (index == null) return result;
        GraphStore store = storeFor(workspace);
        String lower = keyword.toLowerCase();
        int count = 0;
        for (Map.Entry<String, Long> e : index.entrySet()) {
            if (count >= limit) break;
            if (e.getKey().toLowerCase().contains(lower)) {
                Node node = store.getNode(e.getValue());
                if (node != null) {
                    result.add(nodeToEntity(node, workspace));
                    count++;
                }
            }
        }
        return result;
    }

    @Override
    public List<Entity> listEntitiesByType(String workspace, EntityType type, int limit) {
        List<Entity> result = new ArrayList<>();
        GraphStore store = storeFor(workspace);
        List<Long> ids = store.getNodeIdsByLabel(type.name());
        int count = 0;
        for (Long id : ids) {
            if (count >= limit) break;
            Node node = store.getNode(id);
            if (node != null) {
                result.add(nodeToEntity(node, workspace));
                count++;
            }
        }
        return result;
    }

    @Override
    public List<Entity> listAllEntities(String workspace, int limit) {
        List<Entity> result = new ArrayList<>();
        GraphStore store = storeFor(workspace);
        for (Node node : store.getAllNodes()) {
            result.add(nodeToEntity(node, workspace));
            if (result.size() >= limit) break;
        }
        return result;
    }

    @Override
    public Relation upsertRelation(Relation relation) {
        if (relation == null) return null;
        long srcId = upsertEntityNode(relation.getWorkspace(), relation.getSourceEntityName(), EntityType.CONCEPT);
        long tgtId = upsertEntityNode(relation.getWorkspace(), relation.getTargetEntityName(), EntityType.CONCEPT);
        GraphStore store = storeFor(relation.getWorkspace());

        // 去重：检查是否已存在同类型边
        List<Edge> existing = store.getEdges(srcId);
        for (Edge e : existing) {
            if (e.getEndNodeId() == tgtId && e.getType().equals(relation.getType())) {
                // 已存在，更新 weight
                Map<String, Object> props = new LinkedHashMap<>(e.getProperties());
                props.put("weight", relation.getWeight());
                props.put("frequency", relation.getFrequency());
                store.updateEdge(e.getId(), props);
                return relation;
            }
        }

        Map<String, Object> props = new LinkedHashMap<>();
        props.put("weight", relation.getWeight());
        props.put("frequency", relation.getFrequency());
        if (relation.getDescription() != null) props.put("description", relation.getDescription());
        store.addEdge(relation.getType(), srcId, tgtId, props);
        return relation;
    }

    @Override
    public List<Relation> upsertRelations(List<Relation> relations) {
        if (relations == null) return new ArrayList<>();
        for (Relation r : relations) upsertRelation(r);
        return relations;
    }

    @Override
    public List<Relation> getOutRelations(String workspace, String entityName) {
        List<Relation> result = new ArrayList<>();
        Map<String, Long> index = entityNameIndex.get(workspace);
        if (index == null) return result;
        Long id = index.get(entityName);
        if (id == null) return result;
        GraphStore store = storeFor(workspace);
        for (Edge edge : store.getOutEdges(id)) {
            result.add(edgeToRelation(edge, workspace));
        }
        return result;
    }

    @Override
    public List<Relation> getInRelations(String workspace, String entityName) {
        List<Relation> result = new ArrayList<>();
        Map<String, Long> index = entityNameIndex.get(workspace);
        if (index == null) return result;
        Long id = index.get(entityName);
        if (id == null) return result;
        GraphStore store = storeFor(workspace);
        for (Edge edge : store.getInEdges(id)) {
            result.add(edgeToRelation(edge, workspace));
        }
        return result;
    }

    @Override
    public Set<Entity> traverse(String workspace, String entityName, int maxDepth) {
        Set<Entity> result = new LinkedHashSet<>();
        Map<String, Long> index = entityNameIndex.get(workspace);
        if (index == null) return result;
        Long id = index.get(entityName);
        if (id == null) return result;
        GraphStore store = storeFor(workspace);
        Set<Long> ids = store.traverse(id, maxDepth, null);
        for (Long nid : ids) {
            Node node = store.getNode(nid);
            if (node != null) result.add(nodeToEntity(node, workspace));
        }
        return result;
    }

    @Override
    public GraphQueryResult subgraph(String workspace, List<String> entityNames, int depth) {
        GraphQueryResult result = new GraphQueryResult();
        if (entityNames == null) return result;
        Set<Long> visited = new LinkedHashSet<>();
        Set<Long> edgeIds = new LinkedHashSet<>();
        GraphStore store = storeFor(workspace);
        Map<String, Long> index = entityNameIndex.get(workspace);
        if (index == null) return result;

        for (String name : entityNames) {
            Long id = index.get(name);
            if (id == null) continue;
            Set<Long> reached = store.traverse(id, depth, null);
            for (Long nid : reached) {
                visited.add(nid);
                Node node = store.getNode(nid);
                if (node != null) result.getNodes().add(nodeToEntity(node, workspace));
                for (Edge e : store.getEdges(nid)) {
                    edgeIds.add(e.getId());
                }
            }
        }
        for (Long eid : edgeIds) {
            Edge e = store.getEdge(eid);
            if (e != null) result.getEdges().add(edgeToRelation(e, workspace));
        }
        return result;
    }

    @Override
    public boolean deleteEntity(String workspace, String entityName) {
        Map<String, Long> index = entityNameIndex.get(workspace);
        if (index == null) return false;
        Long id = index.remove(entityName);
        if (id == null) return false;
        GraphStore store = storeFor(workspace);
        return store.removeNode(id);
    }

    @Override
    public int deleteByDocument(String workspace, String documentId) {
        GraphStore store = storeFor(workspace);
        int deleted = 0;
        for (Node node : store.getAllNodes()) {
            Object sourceDocs = node.get("sourceDocumentIds");
            if (sourceDocs instanceof List) {
                if (((List<?>) sourceDocs).contains(documentId)) {
                    if (store.removeNode(node.getId())) {
                        deleted++;
                        // 清理索引
                        entityNameIndex.computeIfPresent(workspace, (k, v) -> {
                            v.entrySet().removeIf(en -> en.getValue().equals(node.getId()));
                            return v;
                        });
                    }
                }
            }
        }
        return deleted;
    }

    @Override
    public Map<String, Long> stats(String workspace) {
        GraphStore store = storeFor(workspace);
        Map<String, Long> stats = new LinkedHashMap<>();
        stats.put("nodes", (long) store.getNodeCount());
        stats.put("edges", (long) store.getEdgeCount());
        return stats;
    }

    @Override
    public void close() {
        workspaceStores.clear();
        entityNameIndex.clear();
    }

    private Entity nodeToEntity(Node node, String workspace) {
        Entity e = new Entity();
        e.setId(String.valueOf(node.getId()));
        Object name = node.get("name");
        e.setCanonicalName(name != null ? name.toString() : "node-" + node.getId());
        e.setDisplayName(e.getCanonicalName());
        Object type = node.get("type");
        try {
            e.setType(type != null ? EntityType.valueOf(type.toString()) : EntityType.OTHER);
        } catch (Exception ex) {
            e.setType(EntityType.OTHER);
        }
        e.setWorkspace(workspace);
        return e;
    }

    private Relation edgeToRelation(Edge edge, String workspace) {
        Relation r = new Relation();
        r.setId(String.valueOf(edge.getId()));
        r.setType(edge.getType());
        r.setSourceEntityId(edge.getStartNodeId());
        r.setTargetEntityId(edge.getEndNodeId());
        r.setWorkspace(workspace);
        // 尝试获取端点名称
        GraphStore store = storeFor(workspace);
        Node src = store.getNode(edge.getStartNodeId());
        Node tgt = store.getNode(edge.getEndNodeId());
        if (src != null) r.setSourceEntityName(String.valueOf(src.get("name")));
        if (tgt != null) r.setTargetEntityName(String.valueOf(tgt.get("name")));
        Object weight = edge.get("weight");
        if (weight instanceof Number) r.setWeight(((Number) weight).doubleValue());
        Object freq = edge.get("frequency");
        if (freq instanceof Number) r.setFrequency(((Number) freq).intValue());
        return r;
    }
}
