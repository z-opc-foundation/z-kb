package com.zifang.z.kb.resource.material;

import com.zifang.z.kb.api.material.KbMaterialParser;
import com.zifang.z.kb.api.material.KbParsedText;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * 默认解析器：文本类文件按 UTF-8 直读并剥离 BOM。
 * 二进制格式（PDF/Office/图片）返回失败结果，由宿主提供专用解析实现覆盖或补位。
 */
public class DefaultKbMaterialParser implements KbMaterialParser {

    public static final String PARSER_NAME = "text-simple";
    public static final String PARSER_VERSION = "1.0";

    private static final Set<String> TEXT_EXTENSIONS = Collections.unmodifiableSet(
            new HashSet<>(Arrays.asList(
                    "txt", "md", "markdown", "csv", "json", "xml", "html", "htm", "yml", "yaml",
                    "sql", "java", "js", "ts", "tsx", "jsx", "py", "go", "sh", "log", "properties")));

    @Override
    public boolean supports(String fileName) {
        return TEXT_EXTENSIONS.contains(extensionOf(fileName));
    }

    @Override
    public KbParsedText parse(String fileName, byte[] content) {
        if (!supports(fileName)) {
            return KbParsedText.failed("当前解析器仅支持文本类格式，二进制格式需宿主提供解析实现",
                    PARSER_NAME, PARSER_VERSION);
        }
        String text = new String(content == null ? new byte[0] : content, StandardCharsets.UTF_8);
        if (text.startsWith("\uFEFF")) {
            text = text.substring(1);
        }
        return KbParsedText.ready(text, PARSER_NAME, PARSER_VERSION);
    }

    static String extensionOf(String fileName) {
        int dot = fileName == null ? -1 : fileName.lastIndexOf('.');
        if (dot < 0 || dot == fileName.length() - 1) {
            return "";
        }
        return fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
