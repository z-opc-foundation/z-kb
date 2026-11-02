package com.zifang.z.kb.core.source;

import com.zifang.z.kb.api.source.KnowledgeBaseSourceAccess;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 语雀接入源的同步选择：scope.selection 是一组知识库，每个知识库可选一组文章；
 * 文章列表为空表示整库同步。老配置只有单个 book，按整库兼容读取。
 */
public final class YuqueSelection {

    public static final String SCOPE_KEY = "selection";

    private YuqueSelection() {
    }

    public static List<Book> books(KnowledgeBaseSourceAccess source) {
        return books(source == null ? null : source.getScope());
    }

    public static List<Book> books(Map<String, Object> scope) {
        List<Book> result = new ArrayList<>();
        Object raw = scope == null ? null : scope.get(SCOPE_KEY);
        if (raw instanceof List) {
            for (Object item : (List<?>) raw) {
                if (!(item instanceof Map)) {
                    continue;
                }
                Book book = toBook((Map<?, ?>) item);
                if (book != null) {
                    result.add(book);
                }
            }
        }
        if (!result.isEmpty()) {
            return result;
        }
        String legacy = legacyNamespace(scope);
        if (legacy != null) {
            Book book = new Book();
            book.setBook(legacy);
            book.setName(legacy);
            result.add(book);
        }
        return result;
    }

    public static String bookName(Book book) {
        if (book == null) {
            return null;
        }
        if (book.getName() != null && !book.getName().trim().isEmpty()) {
            return book.getName().trim();
        }
        return book.getBook();
    }

    private static Book toBook(Map<?, ?> raw) {
        String book = text(raw.get("book"));
        if (book == null) {
            return null;
        }
        Book result = new Book();
        result.setBook(book);
        result.setName(text(raw.get("name")));
        Object docs = raw.get("docs");
        if (docs instanceof List) {
            for (Object item : (List<?>) docs) {
                if (!(item instanceof Map)) {
                    continue;
                }
                Map<?, ?> docMap = (Map<?, ?>) item;
                String slug = text(docMap.get("slug"));
                if (slug == null) {
                    continue;
                }
                Doc doc = new Doc();
                doc.setSlug(slug);
                doc.setTitle(text(docMap.get("title")));
                result.getDocs().add(doc);
            }
        }
        return result;
    }

    private static String legacyNamespace(Map<String, Object> scope) {
        Object rawBook = scope == null ? null : scope.get("book");
        String book = text(rawBook);
        if (book == null) {
            return null;
        }
        if (book.contains("/")) {
            return book;
        }
        String group = text(scope.get("namespace"));
        return group == null ? null : group + "/" + book;
    }

    private static String text(Object raw) {
        if (raw == null) {
            return null;
        }
        String text = String.valueOf(raw).trim();
        return text.isEmpty() ? null : text;
    }

    /** 一个被选中的知识库。 */
    public static class Book {

        /** 库标识，形如 group/book。 */
        private String book;

        /** 库显示名，用于建树节点。 */
        private String name;

        /** 选中的文章；为空表示整库同步。 */
        private List<Doc> docs = new ArrayList<>();

        public String getBook() {
            return book;
        }

        public void setBook(String book) {
            this.book = book;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public List<Doc> getDocs() {
            return docs;
        }

        public void setDocs(List<Doc> docs) {
            this.docs = docs == null ? new ArrayList<>() : docs;
        }
    }

    /** 一篇被选中的文章。 */
    public static class Doc {

        private String slug;
        private String title;

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
    }
}
