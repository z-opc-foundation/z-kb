package com.zifang.z.kb.api.material;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * 条目类型。混合库的一棵树里可以放任意类型资料，叶子按条目类型区分展示与解析。
 */
public enum MaterialEntryType {
    DOCUMENT,
    TABLE,
    IMAGE,
    AUDIO,
    VIDEO,
    WEB,
    CODE,
    JSON;

    private static final Set<String> TABLE_EXTS = extSet("xlsx", "xls", "xlsm", "csv", "tsv", "ods");
    private static final Set<String> IMAGE_EXTS = extSet(
            "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "tif", "tiff", "ico", "heic", "avif");
    private static final Set<String> AUDIO_EXTS = extSet(
            "mp3", "wav", "m4a", "aac", "flac", "ogg", "wma", "amr");
    private static final Set<String> VIDEO_EXTS = extSet(
            "mp4", "mov", "avi", "mkv", "webm", "flv", "wmv", "m4v");
    private static final Set<String> WEB_EXTS = extSet("html", "htm", "mhtml", "mht");
    private static final Set<String> JSON_EXTS = extSet("json", "jsonl", "ndjson");
    private static final Set<String> CODE_EXTS = extSet(
            "py", "java", "js", "jsx", "ts", "tsx", "go", "rs", "c", "h", "cpp", "hpp", "cs", "rb",
            "php", "sh", "bash", "sql", "yaml", "yml", "xml", "toml", "kt", "swift", "scala", "lua",
            "css", "scss", "less", "vue", "svelte");

    public static MaterialEntryType resolve(String materialType, String fileName) {
        if (MaterialType.CODE.name().equalsIgnoreCase(materialType)) {
            return CODE;
        }
        if (MaterialType.DATA_TABLE.name().equalsIgnoreCase(materialType)) {
            return TABLE;
        }
        String ext = extensionOf(fileName);
        if (TABLE_EXTS.contains(ext)) {
            return TABLE;
        }
        if (IMAGE_EXTS.contains(ext)) {
            return IMAGE;
        }
        if (AUDIO_EXTS.contains(ext)) {
            return AUDIO;
        }
        if (VIDEO_EXTS.contains(ext)) {
            return VIDEO;
        }
        if (WEB_EXTS.contains(ext)) {
            return WEB;
        }
        if (JSON_EXTS.contains(ext)) {
            return JSON;
        }
        if (CODE_EXTS.contains(ext)) {
            return CODE;
        }
        return DOCUMENT;
    }

    private static Set<String> extSet(String... values) {
        return Collections.unmodifiableSet(new HashSet<>(Arrays.asList(values)));
    }

    private static String extensionOf(String fileName) {
        int dot = fileName == null ? -1 : fileName.lastIndexOf('.');
        if (dot < 0 || dot == fileName.length() - 1) {
            return "";
        }
        return fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
