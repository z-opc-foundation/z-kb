package com.zifang.z.kb.protocol.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 支持的数据源类型摘要 —— 嵌在 {@link ListSourcesResponse#supportedTypes} 里。
 */
@Schema(description = "支持的数据源类型摘要")
public class SourceTypeSummary {

    @Schema(description = "类型枚举名", example = "WEB")
    private String name;

    @Schema(description = "类型中文标签", example = "网页")
    private String label;

    public SourceTypeSummary() {}

    public SourceTypeSummary(String name, String label) {
        this.name = name;
        this.label = label;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
}
