package com.zifang.z.kb.api.source;

import java.util.ArrayList;
import java.util.List;

/**
 * 语雀知识库文章列表：勾选到文章级时展开用。
 */
public class KnowledgeBaseSourceDocListView {

    private List<Doc> docs = new ArrayList<>();
    private String message;

    public List<Doc> getDocs() {
        return docs;
    }

    public void setDocs(List<Doc> docs) {
        this.docs = docs;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public static class Doc {

        private String slug;
        private String title;
        private String updatedAt;

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

        public String getUpdatedAt() {
            return updatedAt;
        }

        public void setUpdatedAt(String updatedAt) {
            this.updatedAt = updatedAt;
        }
    }
}
