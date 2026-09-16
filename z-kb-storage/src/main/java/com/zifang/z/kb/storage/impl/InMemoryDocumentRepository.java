package com.zifang.z.kb.storage.impl;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.Document;
import com.zifang.z.kb.api.DocumentRepository;
import com.zifang.z.kb.api.DocumentStatus;
import com.zifang.z.kb.api.Workspace;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 内存版 DocumentRepository — 简化实现，先支撑核心流程。
 *
 * <p>生产可替换为基于 MyBatis-Plus + MySQL 的实现（见 storage 模块 entity/mapper 包）。
 */
public class InMemoryDocumentRepository implements DocumentRepository {

    private static final Logger log = LoggerFactory.getLogger(InMemoryDocumentRepository.class);

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

    public InMemoryDocumentRepository() {
        // 创建默认工作台
        Workspace defaultWs = new Workspace("default");
        defaultWs.setDescription("默认工作台");
        workspaces.put(defaultWs.getId(), defaultWs);
        ConcurrentHashMap<String, String> nameIdx = new ConcurrentHashMap<>();
        nameIdx.put("default", defaultWs.getId());
        // （name 索引通过遍历实现）
    }

    // ==================== Document ====================

    @Override
    public Document save(Document doc) {
        if (doc == null) return null;
        if (doc.getStatus() == null) doc.setStatus(DocumentStatus.CREATED);
        ConcurrentHashMap<String, Document> map = docs.computeIfAbsent(doc.getWorkspace(), k -> new ConcurrentHashMap<>());
        map.put(doc.getId(), doc);
        if (doc.getPath() != null && !doc.getPath().isEmpty()) {
            ConcurrentHashMap<String, String> pIdx = pathIndex.computeIfAbsent(doc.getWorkspace(), k -> new ConcurrentHashMap<>());
            pIdx.put(doc.getPath(), doc.getId());
        }
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
            boolean match = tags.stream().anyMatch(t -> d.getTags().contains(t));
            if (match) all.add(d);
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
        ConcurrentHashMap<String, Chunk> map = chunks.computeIfAbsent(chunk.getWorkspace(), k -> new ConcurrentHashMap<>());
        map.put(chunk.getId(), chunk);
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
        java.util.Iterator<Chunk> it = map.values().iterator();
        while (it.hasNext()) {
            Chunk c = it.next();
            if (documentId.equals(c.getDocumentId())) {
                it.remove();
                deleted++;
            }
        }
        return deleted;
    }

    // ==================== Workspace ====================

    @Override
    public Workspace createWorkspace(Workspace workspace) {
        if (workspace.getId() == null) {
            workspace.setId(java.util.UUID.randomUUID().toString());
        }
        workspaces.put(workspace.getId(), workspace);
        return workspace;
    }

    @Override
    public Workspace getWorkspace(String id) {
        return workspaces.get(id);
    }

    @Override
    public Workspace getWorkspaceByName(String name) {
        if (name == null) return null;
        for (Workspace w : workspaces.values()) {
            if (name.equals(w.getName())) return w;
        }
        return null;
    }

    @Override
    public List<Workspace> listWorkspaces() {
        return new ArrayList<>(workspaces.values());
    }

    private <T> List<T> paginate(List<T> list, int offset, int limit) {
        if (offset >= list.size()) return Collections.emptyList();
        int from = Math.max(0, offset);
        int to = Math.min(list.size(), from + Math.max(1, limit));
        return list.subList(from, to);
    }
}
