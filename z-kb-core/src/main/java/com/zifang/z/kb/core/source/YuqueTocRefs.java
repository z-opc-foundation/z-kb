package com.zifang.z.kb.core.source;

import com.zifang.z.kb.core.source.yuque.YuqueTocNode;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 语雀目录树 → 可同步文档清单。只认 DOC 节点（TITLE 是分组标题、LINK 是外链），
 * 路径按 parentUuid 逐级回填，层级用 level 字段。
 */
public final class YuqueTocRefs {

    private static final int MAX_DEPTH = 32;

    private YuqueTocRefs() {
    }

    public static List<IngestDocRef> build(List<YuqueTocNode> toc) {
        List<IngestDocRef> refs = new ArrayList<>();
        if (toc == null || toc.isEmpty()) {
            return refs;
        }
        Map<String, YuqueTocNode> byUuid = new LinkedHashMap<>();
        for (YuqueTocNode node : toc) {
            if (node.getUuid() != null) {
                byUuid.put(node.getUuid(), node);
            }
        }
        Set<String> seenSlugs = new HashSet<>();
        for (YuqueTocNode node : toc) {
            if (!"DOC".equalsIgnoreCase(node.getType())) {
                continue;
            }
            if (node.getVisible() == 0) {
                continue;
            }
            String slug = node.getSlug();
            if (slug == null || !seenSlugs.add(slug)) {
                continue;
            }
            String title = node.getTitle();
            refs.add(new IngestDocRef(slug, title == null ? slug : title, node.getDocId(),
                    pathOf(node, byUuid), node.getLevel()));
        }
        return refs;
    }

    /** 自底向上收集祖先标题，遇到环或缺父节点即停。 */
    private static String pathOf(YuqueTocNode node, Map<String, YuqueTocNode> byUuid) {
        List<String> titles = new ArrayList<>();
        Set<String> visited = new HashSet<>();
        YuqueTocNode current = node;
        int depth = 0;
        while (current != null && depth++ < MAX_DEPTH) {
            if (current.getTitle() != null) {
                titles.add(current.getTitle());
            }
            String parent = current.getParentUuid();
            if (parent == null || !visited.add(parent)) {
                break;
            }
            current = byUuid.get(parent);
        }
        Collections.reverse(titles);
        return String.join(" / ", titles);
    }
}
