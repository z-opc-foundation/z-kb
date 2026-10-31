package com.zifang.z.kb.api.source;

import java.util.ArrayList;
import java.util.List;

/**
 * 接入源可选项：语雀团队空间与知识库列表；加载失败原因放 message，不抛异常。
 */
public class KnowledgeBaseSourceCatalogView {

    private List<Space> spaces = new ArrayList<>();
    private List<Book> books = new ArrayList<>();
    private String message;

    public List<Space> getSpaces() {
        return spaces;
    }

    public void setSpaces(List<Space> spaces) {
        this.spaces = spaces;
    }

    public List<Book> getBooks() {
        return books;
    }

    public void setBooks(List<Book> books) {
        this.books = books;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public static class Space {

        private String slug;
        private String name;

        public String getSlug() {
            return slug;
        }

        public void setSlug(String slug) {
            this.slug = slug;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }
    }

    public static class Book {

        private String namespace;
        private String slug;
        private String name;
        private Integer docsCount;
        private Integer visibility;

        public String getNamespace() {
            return namespace;
        }

        public void setNamespace(String namespace) {
            this.namespace = namespace;
        }

        public String getSlug() {
            return slug;
        }

        public void setSlug(String slug) {
            this.slug = slug;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public Integer getDocsCount() {
            return docsCount;
        }

        public void setDocsCount(Integer docsCount) {
            this.docsCount = docsCount;
        }

        public Integer getVisibility() {
            return visibility;
        }

        public void setVisibility(Integer visibility) {
            this.visibility = visibility;
        }
    }
}
