package com.zifang.z.***REMOVED***.api.source;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 本地目录扫描 —— z-***REMOVED*** 侧唯一的「本地文件夹 → 文档清单」实现。
 *
 * <p><b>为什么放在 core 而不是各层各写一份。</b>本仓有两条路径都会扫本地目录：
 * 管道层的 {@code LocalDirSource}（走 {@code /api/***REMOVED***/ingest/run}）与接入源层的
 * 本地接入源（走 {@code /api/***REMOVED***/v1/knowledgeBaseSource/sync}）。两条路径指向的常常是
 * 同一批文件夹（桌面端 note 的工作区），各写一份就会漂移：一边排除了
 * {@code .worktrees}、另一边没排除，同一篇笔记就在两处各存一份。
 * 所以扫描口径（含排除清单）与版本计算都在这里定死，两条路径都调它。
 *
 * <p><b>排除清单跨仓同源。</b>{@link LocalDirScanPolicy#EXCLUDED_DIRS} 的源头在
 * 桌面端 note 仓（{@code z-biz-tool-note/src-tauri/src/commands.rs} 的
 * {@code INDEX_EXCLUDED_DIRS}），改一边必须改另一边。
 *
 * <p><b>版本用内容指纹而不是修改时间。</b>mtime 在复制文件、同步盘拉取时会变，
 * 拿它当版本会让「内容没变」被误判成「已更新」，每次同步都重写一遍物料。
 * 内容没变就是没变，用 SHA-256 判断。
 */
public final class LocalDirScanner {

    /** 单次扫描的文件数上限，防止误指到根目录把进程拖死。 */
    public static final int DEFAULT_LIMIT = 20000;

    /** 目录下的 Markdown 扩展名（小写比较）。 */
    private static final List<String> MARKDOWN_EXTENSIONS = Collections.unmodifiableList(
            new ArrayList<>(java.util.Arrays.asList(".md", ".markdown")));

    private LocalDirScanner() {
    }

    /**
     * 扫描目录下的 Markdown 文件。
     *
     * @param root      根目录
     * @param recursive 是否递归子目录
     * @param limit     最多返回多少篇
     * @throws IOException 目录不存在或不可读
     */
    public static List<LocalDoc> scan(Path root, boolean recursive, int limit)
            throws IOException {
        if (root == null) {
            throw new IOException("目录不能为空");
        }
        Path normalized = root.toAbsolutePath().normalize();
        if (!Files.isDirectory(normalized)) {
            throw new IOException("目录不存在或不是目录: " + root);
        }
        if (!Files.isReadable(normalized)) {
            throw new IOException("目录不可读: " + root);
        }
        int max = limit > 0 ? limit : DEFAULT_LIMIT;

        List<LocalDoc> docs = new ArrayList<>();
        collect(normalized, normalized, recursive, max, docs);
        // 排序保证同一目录每次扫描顺序一致 —— 顺序会影响同步回执里前 N 条失败的展示。
        docs.sort((a, b) -> a.getRelativePath().compareTo(b.getRelativePath()));
        return docs;
    }

    /** 递归收集；被排除的目录直接跳过，不往下走。 */
    private static void collect(Path root, Path current, boolean recursive, int limit,
            List<LocalDoc> out) throws IOException {
        if (out.size() >= limit) {
            return;
        }
        List<Path> children = new ArrayList<>();
        try (java.util.stream.Stream<Path> stream = Files.list(current)) {
            stream.forEach(children::add);
        } catch (UncheckedIOException e) {
            // 单个子目录读不到不该让整次扫描失败：跳过它，继续扫别的。
            return;
        }
        for (Path child : children) {
            if (out.size() >= limit) {
                return;
            }
            if (Files.isDirectory(child)) {
                if (LocalDirScanPolicy.isExcluded(child)) {
                    continue;
                }
                if (recursive) {
                    collect(root, child, recursive, limit, out);
                }
                continue;
            }
            if (!Files.isRegularFile(child) || !isMarkdown(child)) {
                continue;
            }
            out.add(toDoc(root, child));
        }
    }

    private static boolean isMarkdown(Path file) {
        Path name = file.getFileName();
        if (name == null) {
            return false;
        }
        String text = name.toString().toLowerCase(java.util.Locale.ROOT);
        for (String ext : MARKDOWN_EXTENSIONS) {
            if (text.endsWith(ext)) {
                return true;
            }
        }
        return false;
    }

    /** 读一篇文件：正文取 UTF-8，版本取内容 SHA-256。 */
    private static LocalDoc toDoc(Path root, Path file) throws IOException {
        byte[] bytes = Files.readAllBytes(file);
        String content = new String(bytes, StandardCharsets.UTF_8);
        String relative = root.relativize(file).toString();
        return new LocalDoc(relative, file.toAbsolutePath().toString(), inferTitle(content, file),
                content, sha256(bytes), bytes.length);
    }

    /** 标题取正文第一个一级标题，没有就用文件名（去掉扩展名）。 */
    private static String inferTitle(String content, Path file) {
        for (String line : content.split("\n")) {
            String trimmed = line.trim();
            if (trimmed.startsWith("# ")) {
                return trimmed.substring(2).trim();
            }
        }
        Path name = file.getFileName();
        String text = name == null ? "" : name.toString();
        return text.replaceAll("\\.(md|markdown)$", "");
    }

    private static String sha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(bytes);
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16));
                hex.append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }

    /**
     * 一篇本地 Markdown 文档。
     *
     * <p>{@code relativePath} 是幂等键：同一目录里相对路径不变就是同一篇，
     * 跨同步稳定。
     */
    public static final class LocalDoc {

        private final String relativePath;
        private final String absolutePath;
        private final String title;
        private final String content;
        private final String version;
        private final long size;

        LocalDoc(String relativePath, String absolutePath, String title, String content,
                String version, long size) {
            this.relativePath = relativePath;
            this.absolutePath = absolutePath;
            this.title = title;
            this.content = content;
            this.version = version;
            this.size = size;
        }

        public String getRelativePath() {
            return relativePath;
        }

        public String getAbsolutePath() {
            return absolutePath;
        }

        public String getTitle() {
            return title;
        }

        public String getContent() {
            return content;
        }

        /** 内容指纹，用作同步版本。 */
        public String getVersion() {
            return version;
        }

        public long getSize() {
            return size;
        }
    }
}
