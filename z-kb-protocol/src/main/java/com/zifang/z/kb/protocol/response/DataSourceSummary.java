package com.zifang.z.kb.protocol.response;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;

/**
 * 已注册数据源摘要 —— 嵌在 {@link ListSourcesResponse#sources} 里。
 *
 * <p>注意 {@code type} 存的是枚举 <b>名</b>（{@code getType().name()}）而非 {@code getLabel()}，
 * 与改动前的裸 Map 形状保持一致：名给程序判等，标签另有一栏。
 */
@ApiModel(description = "已注册数据源摘要")
public class DataSourceSummary {

    @ApiModelProperty(value = "数据源标识", example = "rss")
    private String sourceId;

    @ApiModelProperty(value = "类型枚举名", example = "RSS")
    private String type;

    @ApiModelProperty(value = "类型中文标签", example = "RSS 订阅")
    private String label;

    @ApiModelProperty(value = "是否启用")
    private boolean enabled;

    public String getSourceId() { return sourceId; }
    public void setSourceId(String sourceId) { this.sourceId = sourceId; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
}
