package com.zifang.z.***REMOVED***.core.source;

import com.zifang.z.***REMOVED***.api.source.LocalDirScanPolicy;
import com.zifang.z.***REMOVED***.api.source.LocalDirScanner;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 本地目录扫描口径自守卫。
 *
 * <p>这些用例守的是「同一批文件夹，z-***REMOVED*** 与桌面端 note 必须看到同一份内容」。
 * 排除清单一旦漂移，同一篇笔记就在两处各存一份 —— 这种 bug 没有编译错误、
 * 没有异常，只表现为「库里多了一份」，所以只能靠这里的用例钉住。
 */
class LocalDirScannerTest {

    // ==================== 排除清单本身的判据 ====================

    /**
     * 阴性对照：清单不能是空的，也不能用通配符。
     *
     * <p>这是防「判据被削成永真」的那道闸。清单一旦变成空集合，所有
     * {@code contains} 判据都恒为 false，扫描会把所有工具产物都收进来，
     * 而测试会安静地通过 —— 功能已经失效，测试却说是绿的。
     */
    @Test
    @DisplayName("排除清单：非空、无通配符、无路径分隔符")
    void excludedListHasTeeth() {
        assertFalse(LocalDirScanPolicy.EXCLUDED_DIRS.isEmpty(),
                "排除清单不能为空，否则功能静默失效");
        for (String name : LocalDirScanPolicy.EXCLUDED_DIRS) {
            assertFalse(name.isEmpty(), "排除项不能是空串");
            assertFalse(name.contains("*"), "排除项要写具体目录名，不能用通配符：" + name);
            assertFalse(name.contains("/"), "排除项只能是目录名，不能含路径分隔符：" + name);
        }
    }

    /** 反例：正常目录不能被排除（否则用户的 notes/work 笔记会消失）。 */
    @Test
    @DisplayName("排除清单：正常目录不被误伤")
    void normalDirsAreNotExcluded() {
        for (String name : new String[]{"notes", "work", "dist-notes", "my-work",
                "images-of-mom", "targeting", "distribution"}) {
            assertFalse(LocalDirScanPolicy.isExcludedName(name), name + " 不该被排除");
        }
    }

    /** 正例：工具产物目录必须被排除。 */
    @Test
    @DisplayName("排除清单：工具产物目录被排除")
    void toolDirsAreExcluded() {
        for (String name : new String[]{".git", "node_modules", "target", "dist",
                ".z-note", "images", ".trash", ".worktrees", ".work"}) {
            assertTrue(LocalDirScanPolicy.isExcludedName(name), name + " 该被排除");
        }
    }

    /**
     * 排除清单必须包含 worktree 副本目录。
     *
     * <p>这是重复索引的病根：2026-10-31 实测一次索引 22082 篇里有 7269 篇
     * （21 万片段）是 {@code .worktrees/fork-*} 下的副本。清单漏了它，
     * 索引直接翻倍 —— 所以单独钉一条，别指望上面的正例清单能兜住。
     */
    @Test
    @DisplayName("排除清单：必须含 worktree 副本目录")
    void worktreeDirsAreExcluded() {
        assertTrue(LocalDirScanPolicy.isExcludedName(".worktrees"), ".worktrees 必须排除");
        assertTrue(LocalDirScanPolicy.isExcludedName(".work"), ".work 必须排除");
    }

    // ==================== 扫描行为 ====================

    @Test
    @DisplayName("扫描：跳过工具产物目录，主库笔记照常收")
    void scanSkipsToolDirsButKeepsMainNotes() throws IOException {
        Path root = tempDir("scan");
        write(root, "main/部署.md", "# 部署\n\n主库笔记。\n");
        write(root, ".worktrees/fork-abc/部署.md", "# 部署\n\n副本。\n");
        write(root, ".work/digest/部署.md", "# 部署\n\n副本。\n");
        write(root, "node_modules/pkg/readme.md", "# readme\n\n依赖。\n");
        write(root, ".git/config.md", "# git\n\n元数据。\n");

        List<LocalDirScanner.LocalDoc> docs = LocalDirScanner.scan(root, true, 1000);

        List<String> paths = docs.stream().map(LocalDirScanner.LocalDoc::getRelativePath)
                .collect(Collectors.toList());
        assertEquals(1, paths.size(), "只应收主库那篇，实际收了：" + paths);
        assertTrue(paths.get(0).contains("main"), "收下的应是主库笔记：" + paths);
    }

    @Test
    @DisplayName("扫描：非递归时不进子目录")
    void scanWithoutRecursionStaysAtTop() throws IOException {
        Path root = tempDir("flat");
        write(root, "顶层.md", "# 顶层\n\n正文。\n");
        write(root, "子/深层.md", "# 深层\n\n正文。\n");

        List<LocalDirScanner.LocalDoc> docs = LocalDirScanner.scan(root, false, 1000);

        assertEquals(1, docs.size(), "非递归只应收顶层那篇");
        assertEquals("顶层.md", docs.get(0).getRelativePath());
    }

    /**
     * 版本必须是内容指纹：内容不变则版本不变，改内容则版本变。
     *
     * <p>这一条是本地接入源增量的地基。版本若取修改时间，复制文件、同步盘拉取
     * 都会让 mtime 变，「内容没变」被误判成「已更新」，每次同步都重写一遍物料。
     */
    @Test
    @DisplayName("版本：内容不变则版本不变，改内容则版本变")
    void versionTracksContentNotTimestamp() throws IOException {
        Path root = tempDir("version");
        Path file = root.resolve("笔记.md");
        write(root, "笔记.md", "# 笔记\n\n第一版。\n");

        String first = LocalDirScanner.scan(root, true, 10).get(0).getVersion();

        // 内容不动：即便 mtime 变了，版本也不该变
        Files.setLastModifiedTime(file, java.nio.file.attribute.FileTime.fromMillis(0L));
        String again = LocalDirScanner.scan(root, true, 10).get(0).getVersion();
        assertEquals(first, again, "内容没变，版本就不该变");

        write(root, "笔记.md", "# 笔记\n\n第二版。\n");
        String changed = LocalDirScanner.scan(root, true, 10).get(0).getVersion();
        assertFalse(first.equals(changed), "内容变了，版本必须变");
    }

    @Test
    @DisplayName("扫描：目录不存在或不是目录要报错")
    void scanRejectsBadRoot() throws IOException {
        Path missing = tempDir("missing").resolve("不存在的目录");
        assertThrows(IOException.class, () -> LocalDirScanner.scan(missing, true, 10));
    }

    @Test
    @DisplayName("扫描：标题取正文一级标题，没有就用文件名")
    void titleInference() throws IOException {
        Path root = tempDir("title");
        write(root, "有标题.md", "# 真正的标题\n\n正文。\n");
        write(root, "无标题.md", "直接是正文，没有标题。\n");

        List<LocalDirScanner.LocalDoc> docs = LocalDirScanner.scan(root, true, 10);

        // 按路径取值，不按下标 —— 排序是按 Unicode 码位，中文名的先后不靠直觉。
        assertEquals("真正的标题", titleOf(docs, "有标题.md"));
        assertEquals("无标题", titleOf(docs, "无标题.md"));
    }

    private String titleOf(List<LocalDirScanner.LocalDoc> docs, String relativePath) {
        for (LocalDirScanner.LocalDoc doc : docs) {
            if (relativePath.equals(doc.getRelativePath())) {
                return doc.getTitle();
            }
        }
        throw new AssertionError("没扫到文件：" + relativePath + "，实际扫到："
                + docs.stream().map(LocalDirScanner.LocalDoc::getRelativePath)
                        .collect(Collectors.toList()));
    }

    @Test
    @DisplayName("扫描：结果按相对路径稳定排序")
    void scanOrderIsStable() throws IOException {
        Path root = tempDir("order");
        write(root, "b.md", "# B\n");
        write(root, "a.md", "# A\n");
        write(root, "c/d.md", "# D\n");

        List<String> first = LocalDirScanner.scan(root, true, 10).stream()
                .map(LocalDirScanner.LocalDoc::getRelativePath).collect(Collectors.toList());
        List<String> second = LocalDirScanner.scan(root, true, 10).stream()
                .map(LocalDirScanner.LocalDoc::getRelativePath).collect(Collectors.toList());

        assertEquals(first, second, "两次扫描顺序必须一致");
        assertEquals(java.util.Arrays.asList("a.md", "b.md", "c/d.md"), first);
    }

    // ==================== 工具 ====================

    private Path tempDir(String tag) throws IOException {
        Path dir = Files.createTempDirectory("z***REMOVED***-local-" + tag + "-");
        dir.toFile().deleteOnExit();
        return dir;
    }

    private void write(Path root, String relative, String content) throws IOException {
        Path file = root.resolve(relative);
        Files.createDirectories(file.getParent());
        Files.write(file, content.getBytes(StandardCharsets.UTF_8));
    }
}
