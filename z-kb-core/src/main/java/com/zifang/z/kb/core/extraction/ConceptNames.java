package com.zifang.z.kb.core.extraction;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;

/**
 * 概念命名口径：规范化名称用于库内归一，概念 ID 由租户/库/规范化名称确定性生成。
 */
public final class ConceptNames {

    private ConceptNames() {
    }

    /** 去首尾空白、转小写并移除全部空白，null 返回空串。 */
    public static String normalize(String name) {
        return name == null ? "" : name.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", "");
    }

    /** 由租户、知识库与归一化名称的哈希生成稳定的概念 ID。 */
    public static String conceptIdOf(String tenantCode, String kbId, String normalizedName) {
        return "cpt_" + sha256Hex(tenantCode + "|" + kbId + "|" + normalizedName).substring(0, 24);
    }

    /** 计算字符串的 SHA-256 十六进制摘要。 */
    static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte item : bytes) {
                hex.append(Character.forDigit((item >> 4) & 0xF, 16));
                hex.append(Character.forDigit(item & 0xF, 16));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }
}
