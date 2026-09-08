package com.zifang.z.kb.api;

/**
 * 关系类型 — 知识图谱的边类型。
 *
 * <p>预定义一组通用关系；具体抽取时也可使用自定义字符串。
 */
public enum RelationType {
    RELATED_TO,       // 关联
    BELONGS_TO,       // 属于
    PART_OF,          // 部分
    USES,             // 使用
    CONTAINS,         // 包含
    PRODUCES,         // 产生
    REQUIRES,         // 依赖
    COMPARED_TO,      // 对比
    SIMILAR_TO,       // 相似
    REFERENCES,       // 引用
    MENTIONED_IN,     // 提及
    AUTHORED_BY,      // 作者
    IMPLEMENTS,       // 实现
    EXTENDS,          // 扩展
    REPLACES,         // 替代
    CONFLICTS_WITH,   // 冲突
    OTHER             // 其他
}
