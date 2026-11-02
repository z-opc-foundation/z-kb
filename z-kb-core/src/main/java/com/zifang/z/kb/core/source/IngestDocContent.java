package com.zifang.z.kb.core.source;

/**
 * 一篇来源文档的正文与版本标记。version 是来源侧的内容更新时间，
 * 用于下次同步时判断正文是否变化。
 */
public class IngestDocContent {

    private final String markdown;
    private final String docId;
    private final String version;

    public IngestDocContent(String markdown, String docId, String version) {
        this.markdown = markdown;
        this.docId = docId;
        this.version = version;
    }

    public String getMarkdown() {
        return markdown;
    }

    public String getDocId() {
        return docId;
    }

    public String getVersion() {
        return version;
    }
}
