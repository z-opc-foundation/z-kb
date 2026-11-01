package com.zifang.z.***REMOVED***.api.source;

import java.nio.file.Path;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * 本地目录扫描口径 —— z-***REMOVED*** 侧与桌面端 note 侧共用同一份排除清单。
 *
 * <p><b>为什么要有这一份。</b>z-***REMOVED*** 与桌面端 note 会指向同一批文件夹（note 的工作区
 * 可以直接配成 z-***REMOVED*** 的本地接入源）。两边各写一份排除规则必然漂移：note 漏了
 * {@code .worktrees}，索引就会把 git worktree 副本收进来；z-***REMOVED*** 漏了同一个目录，
 * 知识库里就会出现同一篇笔记的两份。两边的用户看到的是同一批文件，不该看到两份。
 *
 * <p><b>跨仓同源。</b>这份清单的源头在桌面端 note 仓：
 * {@code z-biz-tool-note/src-tauri/src/commands.rs} 的 {@code INDEX_EXCLUDED_DIRS}。
 * 改一边必须改另一边，否则同源就断了。
 *
 * <p><b>判据只看目录名，不看整条路径。</b>判据是「这个目录本身是工具产物」，
 * 而不是「路径里出现过某个字符串」。后者会把用户自己建的 {@code notes/work/}
 * 之类的正常目录也误伤。
 */
public final class LocalDirScanPolicy {

    /**
     * 扫描时要跳过的目录名（单一事实来源）。
     *
     * <p>分三类：
     * <ul>
     *   <li>版本控制与依赖：{@code .git} / {@code node_modules} / {@code target} / {@code dist}</li>
     *   <li>本应用自身产物：{@code .z-note} / {@code images} / {@code .trash}</li>
     *   <li><b>工具链副本目录</b>：{@code .worktrees} / {@code .work} —— 这是重复索引的真正病根。
     *       git worktree 与临时工作副本里的笔记，与主库同内容各存一份；
     *       2026-10-31 实测：一次索引 22082 篇里有 7269 篇（21 万片段）是 worktree 副本。</li>
     * </ul>
     *
     * <p>注意：只写具体目录名，<b>不能用通配符</b>。通配符会让「清单非空」这类
     * 自检失去意义，也没法逐条验证。
     */
    public static final Set<String> EXCLUDED_DIRS = Collections.unmodifiableSet(
            new HashSet<>(Arrays.asList(
                    ".git",
                    "node_modules",
                    "target",
                    "dist",
                    ".z-note",
                    "images",
                    ".trash",
                    ".worktrees",
                    ".work")));

    private LocalDirScanPolicy() {
    }

    /**
     * 这个目录要不要被排除。
     *
     * @param path 目录路径（只看最后一段目录名）
     */
    public static boolean isExcluded(Path path) {
        if (path == null) {
            return false;
        }
        Path name = path.getFileName();
        if (name == null) {
            return false;
        }
        String text = name.toString();
        return EXCLUDED_DIRS.contains(text);
    }

    /** 目录名是否在排除清单里（不构造 Path 时的便捷入口）。 */
    public static boolean isExcludedName(String name) {
        return name != null && EXCLUDED_DIRS.contains(name);
    }
}
