package com.zifang.z.kb.core.source.yuque;

/** 语雀目录树节点：type 为 DOC/TITLE/LINK，parentUuid 用于回填路径。 */
public class YuqueTocNode {

    private final String uuid;
    private final String parentUuid;
    private final String type;
    private final String slug;
    private final String title;
    private final String docId;
    private final int level;
    private final int visible;

    public YuqueTocNode(String uuid, String parentUuid, String type, String slug, String title,
            String docId, int level, int visible) {
        this.uuid = uuid;
        this.parentUuid = parentUuid;
        this.type = type;
        this.slug = slug;
        this.title = title;
        this.docId = docId;
        this.level = level;
        this.visible = visible;
    }

    public String getUuid() {
        return uuid;
    }

    public String getParentUuid() {
        return parentUuid;
    }

    public String getType() {
        return type;
    }

    public String getSlug() {
        return slug;
    }

    public String getTitle() {
        return title;
    }

    public String getDocId() {
        return docId;
    }

    public int getLevel() {
        return level;
    }

    public int getVisible() {
        return visible;
    }
}
