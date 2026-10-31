package com.zifang.z.kb.core.source;

import com.zifang.z.kb.core.source.git.GitFileNode;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Git 仓库文件树 → 可同步文档清单。只收文本类文档（默认 md/markdown/txt），
 * 跳过隐藏目录与常见的构建产物目录；文件路径本身就是唯一标识。
 */
public final class GitTreeRefs {

    private static final Set<String> DOC_EXTENSIONS = new HashSet<>(
            Arrays.asList("md", "markdown", "mdx", "txt"));

    private static final Set<String> IGNORED_DIRS = new HashSet<>(
            Arrays.asList("node_modules", "target", "build", "dist", "vendor", "out"));

    private static final int MAX_REFS = 5000;

    private GitTreeRefs() {
    }

    public static Result build(List<GitFileNode> tree, String prefix) {
        List<IngestDocRef> refs = new ArrayList<>();
        Map<String, String> versions = new LinkedHashMap<>();
        if (tree == null) {
            return new Result(refs, versions);
        }
        String base = normalizePrefix(prefix);
        for (GitFileNode node : tree) {
            if (refs.size() >= MAX_REFS) {
                break;
            }
            if (!"blob".equalsIgnoreCase(node.getType())) {
                continue;
            }
            String path = node.getPath();
            if (path == null || !inScope(path, base) || !isDoc(path) || ignored(path)) {
                continue;
            }
            String fileName = path.substring(path.lastIndexOf('/') + 1);
            int dot = fileName.lastIndexOf('.');
            String title = dot > 0 ? fileName.substring(0, dot) : fileName;
            refs.add(new IngestDocRef(path, title, null, displayPath(path, title),
                    path.split("/").length - 1));
            if (node.getId() != null) {
                versions.put(path, node.getId());
            }
        }
        return new Result(refs, versions);
    }

    private static boolean isDoc(String path) {
        int dot = path.lastIndexOf('.');
        if (dot < 0) {
            return false;
        }
        return DOC_EXTENSIONS.contains(path.substring(dot + 1).toLowerCase(Locale.ROOT));
    }

    private static boolean inScope(String path, String prefix) {
        return prefix == null || path.equals(prefix) || path.startsWith(prefix + "/");
    }

    private static boolean ignored(String path) {
        for (String segment : path.split("/")) {
            if (segment.startsWith(".") || IGNORED_DIRS.contains(segment)) {
                return true;
            }
        }
        return false;
    }

    /** 目录路径用「 / 」拼成展示路径，并带上文件名，和语雀目录的 path 口径一致。 */
    private static String displayPath(String path, String title) {
        String[] segments = path.split("/");
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < segments.length - 1; i++) {
            if (builder.length() > 0) {
                builder.append(" / ");
            }
            builder.append(segments[i]);
        }
        return builder.length() == 0 ? title : builder.append(" / ").append(title).toString();
    }

    private static String normalizePrefix(String prefix) {
        if (prefix == null || prefix.trim().isEmpty()) {
            return null;
        }
        String value = prefix.trim().replaceAll("^/+", "").replaceAll("/+$", "");
        return value.isEmpty() ? null : value;
    }

    /** 一次文件树遍历的产物：文档清单 + 每篇的 blob 版本。 */
    public static final class Result {

        private final List<IngestDocRef> refs;
        private final Map<String, String> versions;

        private Result(List<IngestDocRef> refs, Map<String, String> versions) {
            this.refs = refs;
            this.versions = versions;
        }

        public List<IngestDocRef> getRefs() {
            return refs;
        }

        public Map<String, String> getVersions() {
            return versions;
        }
    }
}
