package com.zifang.z.kb.protocol.response;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;

import java.util.ArrayList;
import java.util.List;

/**
 * 一次接入批次的汇总 —— {@code /api/kb/ingest/run}、{@code /submit}、{@code /webhook/flush} 共用。
 *
 * <p>顶层四组计数与逐条明细同时给出：前端列表页读 {@code items}，
 * 只想要一行汇总（"这次导了几篇"）时读顶层的 success/failed/skipped 与三个 total。
 */
@ApiModel(description = "接入批次汇总")
public class IngestSummary {

    @ApiModelProperty("本批处理条数")
    private int count;

    @ApiModelProperty("成功数")
    private long success;

    @ApiModelProperty("失败数")
    private long failed;

    @ApiModelProperty("因重复被跳过数")
    private long skipped;

    @ApiModelProperty("产出分块总数")
    private int totalChunks;

    @ApiModelProperty("产出实体总数")
    private int totalEntities;

    @ApiModelProperty("产出关系总数")
    private int totalRelations;

    @ApiModelProperty("逐条明细")
    private List<IngestItemSummary> items = new ArrayList<>();

    public int getCount() { return count; }
    public void setCount(int count) { this.count = count; }
    public long getSuccess() { return success; }
    public void setSuccess(long success) { this.success = success; }
    public long getFailed() { return failed; }
    public void setFailed(long failed) { this.failed = failed; }
    public long getSkipped() { return skipped; }
    public void setSkipped(long skipped) { this.skipped = skipped; }
    public int getTotalChunks() { return totalChunks; }
    public void setTotalChunks(int totalChunks) { this.totalChunks = totalChunks; }
    public int getTotalEntities() { return totalEntities; }
    public void setTotalEntities(int totalEntities) { this.totalEntities = totalEntities; }
    public int getTotalRelations() { return totalRelations; }
    public void setTotalRelations(int totalRelations) { this.totalRelations = totalRelations; }
    public List<IngestItemSummary> getItems() { return items; }
    public void setItems(List<IngestItemSummary> items) { this.items = items; }
}
