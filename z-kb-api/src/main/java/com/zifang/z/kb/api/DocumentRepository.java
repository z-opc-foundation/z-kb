package com.zifang.z.kb.api;

import java.util.List;

/**
 * 文档元数据仓库抽象 — 底层可以是 MySQL / H2 / 文件。
 */
public interface DocumentRepository {

    /** 保存文档 */
    Document save(Document doc);

    /** 按 ID 查询 */
    Document findById(String workspace, String id);

    /** 按路径查询（用于导入去重） */
    Document findByPath(String workspace, String path);

    /** 按 workspace 列出 */
    List<Document> listByWorkspace(String workspace, int offset, int limit);

    /** 按 workspace + 标签筛选 */
    List<Document> listByTags(String workspace, List<String> tags, int offset, int limit);

    /** 按 workspace 统计 */
    long countByWorkspace(String workspace);

    /** 删除文档（软删除） */
    boolean softDelete(String workspace, String id);

    /** 物理删除 */
    boolean hardDelete(String workspace, String id);

    /** 按 ID 列表批量获取 */
    List<Document> findByIds(String workspace, List<String> ids);

    /** 全文搜索 title/path（轻量级 LIKE 搜索） */
    List<Document> searchByTitle(String workspace, String keyword, int limit);

    // ==================== Chunk 元数据 ====================

    /** 保存块元数据 */
    Chunk saveChunk(Chunk chunk);

    /** 批量保存块元数据 */
    List<Chunk> saveChunks(List<Chunk> chunks);

    /** 按文档 ID 获取所有块 */
    List<Chunk> findChunksByDocument(String workspace, String documentId);

    /** 按 ID 获取块 */
    Chunk findChunkById(String workspace, String id);

    /** 按 ID 列表获取块 */
    List<Chunk> findChunksByIds(String workspace, List<String> ids);

    /** 删除某文档的全部块元数据 */
    int deleteChunksByDocument(String workspace, String documentId);

    // ==================== Workspace ====================

    /** 创建工作台 */
    Workspace createWorkspace(Workspace workspace);

    /** 获取工作台 */
    Workspace getWorkspace(String id);

    /** 按名称获取工作台 */
    Workspace getWorkspaceByName(String name);

    /** 列出所有工作台 */
    List<Workspace> listWorkspaces();
}
