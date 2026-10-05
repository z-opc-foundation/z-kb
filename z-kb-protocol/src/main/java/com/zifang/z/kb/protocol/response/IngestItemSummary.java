package com.zifang.z.kb.protocol.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;

/**
 * 单条接入结果摘要 —— 嵌在 {@link IngestSummary#items} 里。
 */
@ApiModel(description = "单条接入结果摘要")
public class IngestItemSummary {

    @ApiModelProperty(value = "请求标识", example = "r-001")
    private String requestId;

    @ApiModelProperty(value = "产出的文档 ID；未产出时为空")
    private String documentId;

    @ApiModelProperty(value = "处理状态枚举名", example = "SUCCESS",
            allowableValues = "SUCCESS, FAILED, SKIPPED_DUPLICATE, INVALID")
    private String status;

    @ApiModelProperty("耗时（毫秒）")
    private long elapsedMillis;

    @ApiModelProperty("产出分块数")
    private int chunkCount;

    @ApiModelProperty("产出实体数")
    private int entityCount;

    @ApiModelProperty("产出关系数")
    private int relationCount;

    /**
     * 失败原因。
     *
     * <p>刻意 {@code NON_NULL}：改造前这里是 {@code if (r.getError() != null) m.put("error", ...)}，
     * 成功项的 JSON 里**没有** {@code error} 这个键。Jackson 默认会为 null 字段输出
     * {@code "error": null}，那会给每个成功项凭空加一个键，属于对外契约变更。
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @ApiModelProperty("失败原因；成功时不返回该字段")
    private String error;

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public String getDocumentId() { return documentId; }
    public void setDocumentId(String documentId) { this.documentId = documentId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public long getElapsedMillis() { return elapsedMillis; }
    public void setElapsedMillis(long elapsedMillis) { this.elapsedMillis = elapsedMillis; }
    public int getChunkCount() { return chunkCount; }
    public void setChunkCount(int chunkCount) { this.chunkCount = chunkCount; }
    public int getEntityCount() { return entityCount; }
    public void setEntityCount(int entityCount) { this.entityCount = entityCount; }
    public int getRelationCount() { return relationCount; }
    public void setRelationCount(int relationCount) { this.relationCount = relationCount; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}
