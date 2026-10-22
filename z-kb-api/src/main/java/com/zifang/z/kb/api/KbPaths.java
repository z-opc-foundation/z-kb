package com.zifang.z.kb.api;

import java.io.File;
import java.nio.file.Paths;

/**
 * z-kb 状态目录的<b>路径约定</b>（1.1.0 起统一口径）。
 *
 * <p>1.1.0 之前 z-kb 的三块本地状态各写各的：
 * <ul>
 *   <li>向量：{@code ./data/zvector}（相对当前工作目录 ⇒ 换个启动目录就是另一份数据）；</li>
 *   <li>图谱 JSON：{@code ~/.zkb/graph}；</li>
 *   <li>文档 JSON：{@code ~/.zkb/zkb.json}。</li>
 * </ul>
 *
 * <p>1.1.0 起统一收敛到 {@code ~/.zkb/} 这一个状态根目录，并且<b>所有可配置路径都接受
 * {@code ~} 展开</b>：写 {@code zkb.vector.data-dir=~/data/vector} 会被展开成
 * {@code /home/<用户>/data/vector}，而不是在当前目录下造一个名字叫「~」的目录。
 *
 * <p>约定：
 * <ul>
 *   <li>{@code ~} 与 {@code ~/...} ⇒ 展开成用户 home 下的绝对路径；</li>
 *   <li>其它相对路径 ⇒ 按当前工作目录绝对化（并在日志里打出来，让人知道数据到底落在哪）；</li>
 *   <li>绝对路径 ⇒ 原样使用。</li>
 * </ul>
 *
 * <p>本类是<b>纯路径计算</b>，不碰磁盘、不读配置，因此放在 SPI 模块里给
 * z-kb-vector / z-kb-graph / z-kb-storage 三个装配层共用。
 */
public final class KbPaths {

    /** z-kb 状态根目录名（相对 home）。 */
    public static final String STATE_DIR_NAME = ".zkb";

    private KbPaths() {
    }

    /**
     * 当前用户 home 目录。
     *
     * <p><b>不缓存</b>：测试会临时改 {@code user.home} 做隔离，缓存住就会读到旧值。
     */
    public static String home() {
        String h = System.getProperty("user.home");
        return (h == null || h.trim().isEmpty()) ? "" : h.trim();
    }

    /** z-kb 状态根目录绝对路径：{@code ~/.zkb}。 */
    public static String stateDir() {
        return home() + File.separator + STATE_DIR_NAME;
    }

    /** 向量存储默认目录：{@code ~/.zkb/vector}。 */
    public static String vectorDataDir() {
        return stateDir() + File.separator + "vector";
    }

    /** 图谱 JSON 默认目录：{@code ~/.zkb/graph}。 */
    public static String graphDir() {
        return stateDir() + File.separator + "graph";
    }

    /** 文档 JSON 默认文件：{@code ~/.zkb/zkb.json}。 */
    public static String documentFile() {
        return stateDir() + File.separator + "zkb.json";
    }

    /**
     * 把配置里的路径展开成绝对路径。
     *
     * @param raw 配置值（可为空）
     * @return 绝对路径；入参为 null / 空白时返回 null（调用方自行决定兜底值）
     */
    public static String expand(String raw) {
        if (raw == null) {
            return null;
        }
        String v = raw.trim();
        if (v.isEmpty()) {
            return null;
        }
        if ("~".equals(v)) {
            return home();
        }
        if (v.startsWith("~/") || v.startsWith("~" + File.separator)) {
            return home() + v.substring(1);
        }
        return Paths.get(v).toAbsolutePath().normalize().toString();
    }
}
