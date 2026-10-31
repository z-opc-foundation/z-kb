package com.zifang.z.kb.api.material;

/**
 * 单个原始文件的一次解析结果。失败也返回本对象，由调用方落成 FAILED 解析稿并记录原因。
 */
public class KbParsedText {

    private final boolean ready;
    private final String text;
    private final String parserName;
    private final String parserVersion;
    private final String failureReason;

    private KbParsedText(boolean ready, String text, String parserName, String parserVersion,
            String failureReason) {
        this.ready = ready;
        this.text = text;
        this.parserName = parserName;
        this.parserVersion = parserVersion;
        this.failureReason = failureReason;
    }

    public static KbParsedText ready(String text, String parserName, String parserVersion) {
        return new KbParsedText(true, text, parserName, parserVersion, null);
    }

    public static KbParsedText failed(String failureReason, String parserName, String parserVersion) {
        return new KbParsedText(false, null, parserName, parserVersion, failureReason);
    }

    public boolean isReady() {
        return ready;
    }

    public String getText() {
        return text;
    }

    public String getParserName() {
        return parserName;
    }

    public String getParserVersion() {
        return parserVersion;
    }

    public String getFailureReason() {
        return failureReason;
    }
}
