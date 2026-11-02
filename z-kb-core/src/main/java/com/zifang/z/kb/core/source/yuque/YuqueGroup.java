package com.zifang.z.kb.core.source.yuque;

/** 语雀团队空间：login 为团队标识，name 为显示名。 */
public class YuqueGroup {

    private final String slug;
    private final String name;

    public YuqueGroup(String slug, String name) {
        this.slug = slug;
        this.name = name;
    }

    public String getSlug() {
        return slug;
    }

    public String getName() {
        return name;
    }
}
