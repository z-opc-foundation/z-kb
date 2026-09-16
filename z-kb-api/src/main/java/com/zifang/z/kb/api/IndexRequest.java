package com.zifang.z.kb.api;

import java.util.List;

/**
 * 单文档索引请求。
 */
public class IndexRequest {

    private Document document;
    /** 是否覆盖已存在的同 ID 文档 */
    private boolean overwrite = true;
    /** 是否同步抽取实体关系 */
    private boolean extractGraph = true;
    /** 自定义标签（覆盖文档自身的 tags） */
    private List<String> tags;
    /** 指定工作台 */
    private String workspace;

    public Document getDocument() { return document; }
    public void setDocument(Document document) { this.document = document; }
    public boolean isOverwrite() { return overwrite; }
    public void setOverwrite(boolean overwrite) { this.overwrite = overwrite; }
    public boolean isExtractGraph() { return extractGraph; }
    public void setExtractGraph(boolean extractGraph) { this.extractGraph = extractGraph; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    public String getWorkspace() { return workspace; }
    public void setWorkspace(String workspace) { this.workspace = workspace; }
}
