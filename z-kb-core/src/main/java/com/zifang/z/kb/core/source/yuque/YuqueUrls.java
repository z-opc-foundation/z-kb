package com.zifang.z.kb.core.source.yuque;

/**
 * 语雀链接解析：{@code https://<tenant>.yuque.com/<group>/<book>/<doc>} → 团队 / 知识库 / 文档三级 slug。
 * 只取域名后的路径段，租户域名本身不参与解析。
 */
public final class YuqueUrls {

    public enum LinkType {
        GROUP,
        BOOK,
        DOC
    }

    /** 解析结果；doc 级链接才能用于拉取正文。 */
    public static final class Link {

        private final LinkType type;
        private final String groupSlug;
        private final String bookSlug;
        private final String docSlug;

        Link(LinkType type, String groupSlug, String bookSlug, String docSlug) {
            this.type = type;
            this.groupSlug = groupSlug;
            this.bookSlug = bookSlug;
            this.docSlug = docSlug;
        }

        public LinkType getType() {
            return type;
        }

        public String getGroupSlug() {
            return groupSlug;
        }

        public String getBookSlug() {
            return bookSlug;
        }

        public String getDocSlug() {
            return docSlug;
        }

        /** 语雀 OpenAPI 的 repos 路径参数：{@code group/book}。非知识库级链接返回 null。 */
        public String namespace() {
            return bookSlug == null ? null : groupSlug + "/" + bookSlug;
        }
    }

    private YuqueUrls() {
    }

    /** 解析失败（非语雀链接或缺少路径段）返回 null。 */
    public static Link parse(String url) {
        if (url == null || !url.contains("yuque.com")) {
            return null;
        }
        String path = url.split("[?#]")[0];
        int hostEnd = path.indexOf("yuque.com");
        path = path.substring(hostEnd + "yuque.com".length());
        String[] raw = path.split("/");
        String groupSlug = null;
        String bookSlug = null;
        String docSlug = null;
        for (String segment : raw) {
            if (segment.isEmpty()) {
                continue;
            }
            if (groupSlug == null) {
                groupSlug = segment;
            } else if (bookSlug == null) {
                bookSlug = segment;
            } else {
                docSlug = segment;
                break;
            }
        }
        if (groupSlug == null) {
            return null;
        }
        LinkType type = docSlug != null ? LinkType.DOC
                : bookSlug != null ? LinkType.BOOK : LinkType.GROUP;
        return new Link(type, groupSlug, bookSlug, docSlug);
    }
}
