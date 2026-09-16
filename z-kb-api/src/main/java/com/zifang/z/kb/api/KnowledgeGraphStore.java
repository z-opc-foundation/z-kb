package com.zifang.z.kb.api;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 知识图谱存储抽象 — 封装底层图数据库（z-graph / Neo4j / NebulaGraph）。
 *
 * <p>每个 workspace 拥有独立的图谱命名空间。
 */
public interface KnowledgeGraphStore {

    /** 写入/更新实体（按 canonicalName + workspace 去重） */
    Entity upsertEntity(Entity entity);

    /** 批量写入实体 */
    List<Entity> upsertEntities(List<Entity> entities);

    /** 按 canonicalName 查询实体 */
    Entity findEntity(String workspace, String canonicalName);

    /** 按 ID 查询实体 */
    Entity getEntity(String workspace, String id);

    /** 按名称模糊查询 */
    List<Entity> searchEntities(String workspace, String keyword, int limit);

    /** 按类型获取实体 */
    List<Entity> listEntitiesByType(String workspace, EntityType type, int limit);

    /** 获取工作台内全部实体 */
    List<Entity> listAllEntities(String workspace, int limit);

    /** 写入关系（去重：相同 source-target-type 累加 weight） */
    Relation upsertRelation(Relation relation);

    /** 批量写入关系 */
    List<Relation> upsertRelations(List<Relation> relations);

    /** 查询某实体的出边 */
    List<Relation> getOutRelations(String workspace, String entityName);

    /** 查询某实体的入边 */
    List<Relation> getInRelations(String workspace, String entityName);

    /** N 跳邻居遍历 */
    Set<Entity> traverse(String workspace, String entityName, int maxDepth);

    /** 子图查询：实体名 → 子图 */
    GraphQueryResult subgraph(String workspace, List<String> entityNames, int depth);

    /** 删除实体（同时删除相关边） */
    boolean deleteEntity(String workspace, String entityName);

    /** 删除某文档相关的全部实体关系 */
    int deleteByDocument(String workspace, String documentId);

    /** 工作台内统计 */
    Map<String, Long> stats(String workspace);

    /** 关闭底层资源 */
    void close();
}
