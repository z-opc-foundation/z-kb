package com.zifang.z.kb.api.material;

/**
 * 分类节点性质。普通分类由页面维护；SOURCE / SOURCE_BOOK / SOURCE_REPO 由接入源同步维护，页面只读。
 */
public enum MaterialCategoryNodeKind {
    FOLDER,
    SOURCE,
    SOURCE_BOOK,
    SOURCE_REPO
}
