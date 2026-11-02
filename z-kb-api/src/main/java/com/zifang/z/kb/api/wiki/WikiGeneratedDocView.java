package com.zifang.z.kb.api.wiki;

import java.util.ArrayList;
import java.util.List;

/**
 * Wiki 文档目录视图：页面集合与证据块覆盖。
 */
public class WikiGeneratedDocView {

    private String materialId;
    private String materialVersionId;
    private String indexMd;
    private Integer pageCount;
    private Integer chunkCount;
    private Integer coveredChunkCount;
    private Integer versionNo;
    private String generator;
    private List<Page> pages = new ArrayList<>();

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

    public Integer getPageCount() {
        return pageCount;
    }

    public void setPageCount(Integer pageCount) {
        this.pageCount = pageCount;
    }

    public Integer getChunkCount() {
        return chunkCount;
    }

    public void setChunkCount(Integer chunkCount) {
        this.chunkCount = chunkCount;
    }

    public Integer getCoveredChunkCount() {
        return coveredChunkCount;
    }

    public void setCoveredChunkCount(Integer coveredChunkCount) {
        this.coveredChunkCount = coveredChunkCount;
    }

    public Integer getVersionNo() {
        return versionNo;
    }

    public void setVersionNo(Integer versionNo) {
        this.versionNo = versionNo;
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
        this.pages = pages;
    }

    /** 目录内的单页。 */
    public static class Page {

        private String wikiId;
        private String slug;
        private String title;
        private String summary;
        private Integer charCount;
        private Integer versionNo;
        private List<String> chunkIds = new ArrayList<>();

        public String getWikiId() {
            return wikiId;
        }

        public void setWikiId(String wikiId) {
            this.wikiId = wikiId;
        }

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

        public Integer getCharCount() {
            return charCount;
        }

        public void setCharCount(Integer charCount) {
            this.charCount = charCount;
        }

        public Integer getVersionNo() {
            return versionNo;
        }

        public void setVersionNo(Integer versionNo) {
            this.versionNo = versionNo;
        }

        public List<String> getChunkIds() {
            return chunkIds;
        }

        public void setChunkIds(List<String> chunkIds) {
            this.chunkIds = chunkIds;
        }
    }
}
