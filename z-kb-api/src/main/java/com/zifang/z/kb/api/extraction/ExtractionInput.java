package com.zifang.z.kb.api.extraction;

import java.util.ArrayList;
import java.util.List;

/**
 * 本地规则萃取的输入：一份物料版本的已索引检索块。
 */
public class ExtractionInput {

    private String kbId;
    private String materialId;
    private String materialVersionId;
    private String materialTitle;
    private String draftId;
    private List<ExtractionChunk> chunks = new ArrayList<>();

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getMaterialId() {
        return materialId;
    }

    public void setMaterialId(String materialId) {
        this.materialId = materialId;
    }

    public String getMaterialVersionId() {
        return materialVersionId;
    }

    public void setMaterialVersionId(String materialVersionId) {
        this.materialVersionId = materialVersionId;
    }

    public String getMaterialTitle() {
        return materialTitle;
    }

    public void setMaterialTitle(String materialTitle) {
        this.materialTitle = materialTitle;
    }

    public String getDraftId() {
        return draftId;
    }

    public void setDraftId(String draftId) {
        this.draftId = draftId;
    }

    public List<ExtractionChunk> getChunks() {
        return chunks;
    }

    public void setChunks(List<ExtractionChunk> chunks) {
        this.chunks = chunks == null ? new ArrayList<>() : chunks;
    }
}
