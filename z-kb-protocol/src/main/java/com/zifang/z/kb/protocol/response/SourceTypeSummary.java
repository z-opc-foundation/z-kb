package com.zifang.z.kb.protocol.response;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;

/**
 * 支持的数据源类型摘要 —— 嵌在 {@link ListSourcesResponse#supportedTypes} 里。
 */
@ApiModel(description = "支持的数据源类型摘要")
public class SourceTypeSummary {

    @ApiModelProperty(value = "类型枚举名", example = "WEB")
    private String name;

    @ApiModelProperty(value = "类型中文标签", example = "网页")
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
