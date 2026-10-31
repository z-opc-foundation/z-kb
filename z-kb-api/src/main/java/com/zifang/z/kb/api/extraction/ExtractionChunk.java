package com.zifang.z.kb.api.extraction;

/**
 * 萃取输入中的检索块视图，序号与 retrieval_chunk.ordinal 一致，从 1 开始。
 */
public class ExtractionChunk {

    private Integer ordinal;
    private String heading;
    private String content;

    public Integer getOrdinal() {
        return ordinal;
    }

    public void setOrdinal(Integer ordinal) {
        this.ordinal = ordinal;
    }

    public String getHeading() {
        return heading;
    }

    public void setHeading(String heading) {
        this.heading = heading;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public ExtractionChunk() {
    }

    public ExtractionChunk(Integer ordinal, String heading, String content) {
        this.ordinal = ordinal;
        this.heading = heading;
        this.content = content;
    }
}
