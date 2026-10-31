package com.zifang.z.kb.core.source;

import com.zifang.z.kb.core.source.git.GitFileNode;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 把一个代码仓库压成可编译的 Markdown 摘要：目录概览 + README + 文本类文档。
 * 代码正文不入库，仍由 Git 提供；摘要只用于切块、萃取与 Wiki 生成。
 *
 * <p>大仓的文件清单会挤占编译预算（几百行路径切成几十个块），所以目录只做两级汇总；
 * 留给文档正文的配额按「越靠近仓库说明与架构文档越优先」取样，避免只读到按字母序排在前面的几篇。</p>
 */
public final class GitRepoDigest {

    /** 文件数不超过它时平铺清单，超过后按目录汇总，避免摘要被大仓撑爆。 */
    public static final int MAX_TREE_LINES = 120;

    /** 目录汇总最多输出这么多行（含二级目录），超出只记数量。 */
    public static final int MAX_ROLLUP_LINES = 80;

    public static final int MAX_DOC_FILES = 40;

    public static final int MAX_DOC_CHARS = 5000;

    public static final int MAX_TOTAL_CHARS = 120000;

    private static final Set<String> IGNORED_DIRS = new HashSet<>(
            Arrays.asList("node_modules", "target", "build", "dist", "vendor", "out"));

    private static final Set<String> CODE_EXTENSIONS = new HashSet<>(Arrays.asList(
            "java", "kt", "scala", "groovy", "py", "go", "rs", "c", "h", "cpp", "hpp", "cc",
            "cs", "php", "rb", "swift", "m", "mm", "js", "jsx", "ts", "tsx", "vue", "svelte",
            "sql", "sh", "bash", "zsh", "ps1", "proto", "graphql", "tf"));

    private GitRepoDigest() {
    }

    /**
     * @param title 物料标题，通常是仓库路径
     * @param prefix 只把这个目录下的文本类文档收进摘要；空表示整库
     * @param reader 按仓库内路径读文本，读失败返回 null 或抛异常都由调用方兜底
     */
    public static Result build(String title, String repoUrl, String ref, String commit,
            List<GitFileNode> tree, String prefix, DocReader reader) {
        List<String> blobPaths = new ArrayList<>();
        int docCount = 0;
        int codeCount = 0;
        if (tree != null) {
            for (GitFileNode node : tree) {
                if (!"blob".equalsIgnoreCase(node.getType())) {
                    continue;
                }
                String path = node.getPath();
                if (path == null) {
                    continue;
                }
                blobPaths.add(path);
                if (ignored(path)) {
                    continue;
                }
                if (isDoc(path)) {
                    docCount++;
                } else if (isCode(path)) {
                    codeCount++;
                }
            }
        }
        Collections.sort(blobPaths);

        StringBuilder out = new StringBuilder();
        out.append("# ").append(title).append("\n\n");
        out.append("> 仓库：").append(repoUrl).append("\n");
        out.append("> 分支：`").append(ref).append("`\n");
        if (commit != null && !commit.isEmpty()) {
            out.append("> 提交：`").append(commit).append("`\n");
        }
        out.append("> 文件 ").append(blobPaths.size()).append(" 个：文档 ").append(docCount)
                .append(" · 代码 ").append(codeCount)
                .append(" · 其他 ").append(Math.max(0, blobPaths.size() - docCount - codeCount))
                .append("\n\n");

        appendOverview(out, blobPaths);

        List<IngestDocRef> docs = selectDocs(tree, prefix);
        String readmePath = rootReadme(blobPaths);

        int appended = 0;
        boolean readmeSection = false;
        boolean docSection = false;
        for (IngestDocRef doc : docs) {
            if (appended >= MAX_DOC_FILES || out.length() >= MAX_TOTAL_CHARS) {
                break;
            }
            String content = read(reader, doc.getSlug());
            if (content == null || content.trim().isEmpty()) {
                continue;
            }
            boolean isReadme = readmePath != null && readmePath.equals(doc.getSlug());
            if (isReadme) {
                if (!readmeSection) {
                    out.append("\n## 项目说明\n\n");
                    readmeSection = true;
                }
            } else if (!docSection) {
                out.append("\n## 文档\n\n");
                docSection = true;
            }
            out.append("### ").append(doc.getSlug()).append("\n\n");
            int room = Math.min(MAX_DOC_CHARS, MAX_TOTAL_CHARS - out.length());
            if (room <= 0) {
                break;
            }
            String body = content.length() > room
                    ? content.substring(0, room) + "\n\n（已截断）" : content;
            out.append(body).append("\n\n");
            appended++;
        }
        return new Result(out.toString(), blobPaths.size(), docCount, codeCount);
    }

    /** 目录部分：小仓平铺文件清单，大仓按一级/二级目录做规模汇总，两者都带「其余未列出」。 */
    private static void appendOverview(StringBuilder out, List<String> blobPaths) {
        List<String> visible = new ArrayList<>();
        for (String path : blobPaths) {
            if (!ignored(path)) {
                visible.add(path);
            }
        }
        out.append("## 目录概览\n\n");
        if (visible.size() <= MAX_TREE_LINES) {
            for (String path : visible) {
                out.append("- `").append(path).append("`\n");
            }
            if (visible.size() < blobPaths.size()) {
                out.append("- 其余 ").append(blobPaths.size() - visible.size())
                        .append(" 个文件未列出\n");
            }
            return;
        }
        appendRollup(out, visible);
    }

    /** 按两级目录汇总文件规模：一级给总量，二级给文档数与代码数，行数有上限。 */
    private static void appendRollup(StringBuilder out, List<String> visible) {
        Map<String, DirStat> roots = new LinkedHashMap<>();
        Map<String, Map<String, DirStat>> children = new LinkedHashMap<>();
        DirStat rootFiles = new DirStat();
        for (String path : visible) {
            int slash = path.indexOf('/');
            if (slash < 0) {
                rootFiles.add(path);
                continue;
            }
            String root = path.substring(0, slash);
            DirStat rootStat = roots.get(root);
            if (rootStat == null) {
                rootStat = new DirStat();
                roots.put(root, rootStat);
                children.put(root, new LinkedHashMap<>());
            }
            rootStat.add(path);
            String rest = path.substring(slash + 1);
            int slash2 = rest.indexOf('/');
            if (slash2 > 0) {
                String sub = rest.substring(0, slash2);
                DirStat subStat = children.get(root).get(sub);
                if (subStat == null) {
                    subStat = new DirStat();
                    children.get(root).put(sub, subStat);
                }
                subStat.add(path);
            }
        }
        int lines = 0;
        if (rootFiles.total > 0) {
            out.append("- 根目录：文件 ").append(rootFiles.total).append(" · 文档 ")
                    .append(rootFiles.docs).append(" · 代码 ").append(rootFiles.code).append('\n');
            lines++;
        }
        for (Map.Entry<String, DirStat> entry : roots.entrySet()) {
            if (lines >= MAX_ROLLUP_LINES) {
                out.append("- 其余目录未列出\n");
                return;
            }
            DirStat stat = entry.getValue();
            out.append("- `").append(entry.getKey()).append("/`：文件 ").append(stat.total)
                    .append(" · 文档 ").append(stat.docs).append(" · 代码 ").append(stat.code)
                    .append('\n');
            lines++;
            for (Map.Entry<String, DirStat> child : children.get(entry.getKey()).entrySet()) {
                if (lines >= MAX_ROLLUP_LINES) {
                    out.append("  - 其余子目录未列出\n");
                    break;
                }
                DirStat sub = child.getValue();
                out.append("  - `").append(child.getKey()).append("/` 文件 ").append(sub.total)
                        .append(" · 文档 ").append(sub.docs).append(" · 代码 ").append(sub.code)
                        .append('\n');
                lines++;
            }
        }
    }

    /**
     * 文档取样：先按「越靠近仓库说明越优先」排序，再在配额内依次读取。
     * 排序固定为 README → 客户文档 → 架构文档 → 各 feature 任务书 → 模块 README → 其余文档。
     */
    private static List<IngestDocRef> selectDocs(List<GitFileNode> tree, String prefix) {
        List<IngestDocRef> docs = new ArrayList<>(GitTreeRefs.build(tree, prefix).getRefs());
        Collections.sort(docs, (left, right) -> {
            int diff = priority(left.getSlug()) - priority(right.getSlug());
            return diff != 0 ? diff : left.getSlug().compareTo(right.getSlug());
        });
        return docs;
    }

    /** 文档优先级：数值越小越先进入摘要。 */
    static int priority(String path) {
        String slug = path == null ? "" : path;
        if (isRootReadme(slug)) {
            return 0;
        }
        if (slug.startsWith("_docs/_CUSTOMER/")) {
            return 1;
        }
        if (slug.startsWith("_docs/_DEVELOP/001_ARCH/") || "principle.md".equals(slug)) {
            return 2;
        }
        if (slug.startsWith("_docs/_DEVELOP/002_FEATURE/") && slug.endsWith("/000_TASK.md")) {
            return 3;
        }
        if (isModuleReadme(slug)) {
            return 4;
        }
        if (slug.startsWith("_docs/")) {
            return 5;
        }
        return 6;
    }

    private static boolean isRootReadme(String path) {
        return path.indexOf('/') < 0 && isReadmeName(path);
    }

    /** 模块 README：只在模块根（路径仅一段目录 + README）算，深层 README 归入普通文档。 */
    private static boolean isModuleReadme(String path) {
        if (!isReadmeName(path)) {
            return false;
        }
        return path.split("/").length == 2;
    }

    private static boolean isReadmeName(String path) {
        String name = path.substring(path.lastIndexOf('/') + 1);
        int dot = name.lastIndexOf('.');
        if (dot <= 0 || !isDoc(name)) {
            return false;
        }
        return "readme".equals(name.substring(0, dot).toLowerCase(Locale.ROOT));
    }

    /** 仓库根目录的 README，供「项目说明」小节使用。 */
    private static String rootReadme(List<String> blobPaths) {
        for (String path : blobPaths) {
            if (isRootReadme(path)) {
                return path;
            }
        }
        return null;
    }

    private static String read(DocReader reader, String path) {
        try {
            return reader.read(path);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static boolean isDoc(String path) {
        String ext = extension(path);
        return ext != null && ("md".equals(ext) || "markdown".equals(ext) || "mdx".equals(ext)
                || "txt".equals(ext));
    }

    private static boolean isCode(String path) {
        String ext = extension(path);
        return ext != null && CODE_EXTENSIONS.contains(ext);
    }

    private static String extension(String path) {
        int dot = path.lastIndexOf('.');
        if (dot < 0 || dot < path.lastIndexOf('/')) {
            return null;
        }
        return path.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static boolean ignored(String path) {
        for (String segment : path.split("/")) {
            if (segment.startsWith(".") || IGNORED_DIRS.contains(segment)) {
                return true;
            }
        }
        return false;
    }

    /** 目录规模计数：全部文件、文本类文档、代码文件。 */
    private static final class DirStat {

        private int total;
        private int docs;
        private int code;

        private void add(String path) {
            total++;
            if (isDoc(path)) {
                docs++;
            } else if (isCode(path)) {
                code++;
            }
        }
    }

    /** 供应商侧只需实现「按路径读文本」。 */
    public interface DocReader {

        String read(String path);
    }

    /** 摘要正文与统计，统计同时写进物料 metadata。 */
    public static final class Result {

        private final String markdown;
        private final int fileCount;
        private final int docCount;
        private final int codeCount;

        private Result(String markdown, int fileCount, int docCount, int codeCount) {
            this.markdown = markdown;
            this.fileCount = fileCount;
            this.docCount = docCount;
            this.codeCount = codeCount;
        }

        public String getMarkdown() {
            return markdown;
        }

        public int getFileCount() {
            return fileCount;
        }

        public int getDocCount() {
            return docCount;
        }

        public int getCodeCount() {
            return codeCount;
        }
    }
}
