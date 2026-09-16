package com.zifang.z.kb.api;

import java.io.InputStream;
import java.util.List;

/**
 * 知识库核心服务 — 协调 DocumentRepository / ChunkVectorStore / KnowledgeGraphStore。
 *
 * <p>这是面向用户（web 层 / 前端）的主入口。
 */
public interface KnowledgeBaseService {

    // ==================== 文档管理 ====================

    /** 索引单篇文档 */
    ImportResult indexDocument(IndexRequest request);

    /** 批量索引 */
    List<ImportResult> indexBatch(List<IndexRequest> requests);

    /** 从 Markdown 文本导入 */
    ImportResult importMarkdown(String workspace, String title, String markdown,
                                 List<String> tags, String author);

    /** 从 Markdown 文件批量导入 */
    List<ImportResult> importMarkdownDir(String workspace, String directoryPath);

    /** 按 ID 删除（同时清理向量、图谱、元数据） */
    boolean deleteDocument(String workspace, String documentId);

    /** 按 workspace 删除全部 */
    int deleteAll(String workspace);

    /** 查询文档 */
    Document getDocument(String workspace, String id);

    /** 列出 workspace 内文档 */
    List<Document> listDocuments(String workspace, int offset, int limit);

    /** 按标签筛选 */
    List<Document> listDocumentsByTags(String workspace, List<String> tags, int offset, int limit);

    /** 文档统计 */
    long countDocuments(String workspace);

    // ==================== 工作台 ====================

    Workspace createWorkspace(String name, String description);

    Workspace getWorkspace(String name);

    List<Workspace> listWorkspaces();

    // ==================== 文档块 ====================

    /** 按文档获取所有块 */
    List<Chunk> getChunks(String workspace, String documentId);

    /** 重建文档索引（先删除再插入） */
    ImportResult reindex(String workspace, String documentId);

    // ==================== 图谱 ====================

    /** 列出工作台内全部实体 */
    List<Entity> listEntities(String workspace, int limit);

    /** 按名称查询实体 */
    Entity getEntity(String workspace, String name);

    /** 实体邻居遍历 */
    List<Entity> getNeighbors(String workspace, String entityName, int depth);

    /** 子图查询 */
    GraphQueryResult getSubgraph(String workspace, List<String> entityNames, int depth);

    // ==================== 统计 ====================

    /** 工作台综合统计 */
    KBStatistics statistics(String workspace);

    // ==================== 资源管理 ====================

    /** 关闭并释放资源 */
    void close();
}
