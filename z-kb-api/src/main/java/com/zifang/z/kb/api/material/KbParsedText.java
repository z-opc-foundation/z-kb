package com.zifang.z.***REMOVED***.api.material;

/**
 * 单个原始文件的一次解析结果。失败也返回本对象，由调用方落成 FAILED 解析稿并记录原因。
 */
public class ***REMOVED***ParsedText {

    private final boolean ready;
    private final String text;
    private final String parserName;
    private final String parserVersion;
    private final String failureReason;

    private ***REMOVED***ParsedText(boolean ready, String text, String parserName, String parserVersion,
            String failureReason) {
        this.ready = ready;
        this.text = text;
        this.parserName = parserName;
        this.parserVersion = parserVersion;
        this.failureReason = failureReason;
    }

    public static ***REMOVED***ParsedText ready(String text, String parserName, String parserVersion) {
        return new ***REMOVED***ParsedText(true, text, parserName, parserVersion, null);
    }

    public static ***REMOVED***ParsedText failed(String failureReason, String parserName, String parserVersion) {
        return new ***REMOVED***ParsedText(false, null, parserName, parserVersion, failureReason);
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
