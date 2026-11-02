package com.zifang.z.kb.api.resource;

/**
 * 知识库类型（对齐参考实现 knowledgeBase.type）。
 */
public enum KnowledgeBaseType {
    /** 文件库：以文档/资料为主 */
    FILE,
    /** 混合库：文件 + 代码 + 手工内容 */
    MIX,
    /** 语雀库：接入源以语雀为主 */
    YUQUE,
    /** 代码库：接入源为 Git 仓库 */
    CODE
}
