package com.zifang.z.kb.api;

/**
 * Token 估算器 — 抽象接口，便于切换不同的 tokenizer。
 *
 * <p>默认实现见 z-kb-core 的 CharacterBasedTokenEstimator（中英文混合按字符估算）。
 * 生产可切换到 OpenAI tiktoken 或其他精确 tokenizer。
 */
public interface TokenEstimator {

    /** 估算文本的 token 数 */
    int estimate(String text);

    /** 默认实现：1 token ≈ 0.75 英文词 / 1.5 中文字符 */
    TokenEstimator DEFAULT = new TokenEstimator() {
        @Override
        public int estimate(String text) {
            if (text == null || text.isEmpty()) return 0;
            int chineseChars = 0;
            int otherChars = 0;
            for (int i = 0; i < text.length(); ) {
                int cp = text.codePointAt(i);
                if (cp >= 0x4E00 && cp <= 0x9FFF) {
                    chineseChars++;
                    i += Character.charCount(cp);
                } else if (Character.isLetterOrDigit(cp)) {
                    otherChars++;
                    i += Character.charCount(cp);
                } else {
                    i += Character.charCount(cp);
                }
            }
            return chineseChars + (int) Math.ceil(otherChars / 3.5);
        }
    };
}
