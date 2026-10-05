package com.zifang.z.kb.protocol.response;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;

import java.util.ArrayList;
import java.util.List;

/**
 * 数据源清单 —— {@code GET /api/kb/ingest/sources}。
 */
@ApiModel(description = "已注册数据源清单")
public class ListSourcesResponse {

    @ApiModelProperty("当前已注册的数据源")
    private List<DataSourceSummary> sources = new ArrayList<>();

    @ApiModelProperty("全部支持的数据源类型，含尚未注册的")
    private List<SourceTypeSummary> supportedTypes = new ArrayList<>();

    public List<DataSourceSummary> getSources() { return sources; }
    public void setSources(List<DataSourceSummary> sources) { this.sources = sources; }
    public List<SourceTypeSummary> getSupportedTypes() { return supportedTypes; }
    public void setSupportedTypes(List<SourceTypeSummary> supportedTypes) { this.supportedTypes = supportedTypes; }
}
