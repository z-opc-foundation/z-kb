package com.zifang.z.kb.resource.source;

import com.zifang.z.kb.api.material.MaterialCategoryNode;
import com.zifang.z.kb.api.material.MaterialCategoryService;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceAccess;
import com.zifang.z.kb.core.source.YuqueSelection;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 把接入源同步成资料树上的只读节点：接入源一个节点，语雀按知识库、Git 按仓库各一个子节点。
 * 节点按源标识幂等复用，文档物料挂在知识库节点下，代码仓库物料挂在项目节点下。
 */
public class SourceTreeNodes {

    private final MaterialCategoryService categoryService;

    public SourceTreeNodes(MaterialCategoryService categoryService) {
        this.categoryService = categoryService;
    }

    /** 确保接入源节点存在，返回节点分类标识。 */
    public String ensureSourceNode(String kbId, KnowledgeBaseSourceAccess source, KbCaller caller) {
        Map<String, Object> ext = new LinkedHashMap<>();
        ext.put("sourceId", source.getSourceId());
        ext.put("provider", source.getProvider());
        String namespace = source.scopeValue("namespace");
        if (namespace != null) {
            ext.put("namespace", namespace);
        }
        MaterialCategoryNode info = categoryService.ensureBoundNode(kbId, null,
                MaterialCategoryService.NODE_SOURCE, source.getName(),
                "SOURCE:" + source.getSourceId(), ext, caller);
        return info.getCategoryId();
    }

    /** 确保来源下的知识库节点存在，返回节点分类标识。 */
    public String ensureBookNode(String kbId, String sourceCategoryId,
            KnowledgeBaseSourceAccess source, YuqueSelection.Book book, KbCaller caller) {
        String bookScope = book.getBook().trim();
        Map<String, Object> ext = new LinkedHashMap<>();
        ext.put("sourceId", source.getSourceId());
        ext.put("provider", source.getProvider());
        ext.put("namespace", bookScope);
        ext.put("book", bookScope.contains("/")
                ? bookScope.substring(bookScope.lastIndexOf('/') + 1) : bookScope);
        MaterialCategoryNode info = categoryService.ensureBoundNode(kbId, sourceCategoryId,
                MaterialCategoryService.NODE_SOURCE_BOOK, YuqueSelection.bookName(book),
                "SOURCE_BOOK:" + source.getSourceId() + ":" + bookScope, ext, caller);
        return info.getCategoryId();
    }

    /** 确保来源下的代码项目节点存在：一个仓库一个节点，返回节点分类标识。 */
    public String ensureRepoNode(String kbId, String sourceCategoryId,
            KnowledgeBaseSourceAccess source, String name, String repoScope, String branch,
            KbCaller caller) {
        Map<String, Object> ext = new LinkedHashMap<>();
        ext.put("sourceId", source.getSourceId());
        ext.put("provider", source.getProvider());
        ext.put("namespace", repoScope);
        ext.put("repo", repoScope);
        ext.put("branch", branch);
        MaterialCategoryNode info = categoryService.ensureBoundNode(kbId, sourceCategoryId,
                MaterialCategoryService.NODE_SOURCE_REPO, name,
                "SOURCE_REPO:" + source.getSourceId() + ":" + repoScope, ext, caller);
        return info.getCategoryId();
    }
}
