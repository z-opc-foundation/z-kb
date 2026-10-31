package com.zifang.z.kb.api.wiki;

import java.util.ArrayList;
import java.util.List;

/**
 * Agent 编译产物写入参数：一次编译的页面集合与目录。
 */
public class WikiAgentSaveParam {

    private String kbId;
    private String materialId;
    private String materialVersionId;
    private String indexMd;
    private Integer chunkCount;
    private String generator;
    private List<Page> pages = new ArrayList<>();

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getMaterialId() {
        return materialId;
    }

    public void setMaterialId(String materialId) {
        this.materialId = materialId;
    }

    public String getMaterialVersionId() {
        return materialVersionId;
    }

    public void setMaterialVersionId(String materialVersionId) {
        this.materialVersionId = materialVersionId;
    }

    public String getIndexMd() {
        return indexMd;
    }

    public void setIndexMd(String indexMd) {
        this.indexMd = indexMd;
    }

    public Integer getChunkCount() {
        return chunkCount;
    }

    public void setChunkCount(Integer chunkCount) {
        this.chunkCount = chunkCount;
    }

    public String getGenerator() {
        return generator;
    }

    public void setGenerator(String generator) {
        this.generator = generator;
    }

    public List<Page> getPages() {
        return pages;
    }

    public void setPages(List<Page> pages) {
        this.pages = pages == null ? new ArrayList<>() : pages;
    }

    /** 单页内容。 */
    public static class Page {

        private String slug;
        private String title;
        private String summary;
        private String content;
        private List<String> chunkIds = new ArrayList<>();

        public String getSlug() {
            return slug;
        }

        public void setSlug(String slug) {
            this.slug = slug;
        }

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public String getSummary() {
            return summary;
        }

        public void setSummary(String summary) {
            this.summary = summary;
        }

        public String getContent() {
            return content;
        }

        public void setContent(String content) {
            this.content = content;
        }

        public List<String> getChunkIds() {
            return chunkIds;
        }

        public void setChunkIds(List<String> chunkIds) {
            this.chunkIds = chunkIds == null ? new ArrayList<>() : chunkIds;
        }
    }
}
