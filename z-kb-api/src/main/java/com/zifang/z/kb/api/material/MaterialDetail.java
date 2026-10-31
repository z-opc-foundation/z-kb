package com.zifang.z.kb.api.material;

import java.util.ArrayList;
import java.util.List;

/**
 * 物料详情：物料 + 全部历史版本 + 当前版本解析稿。
 */
public class MaterialDetail {

    private MaterialView material;
    private List<MaterialVersionView> versions = new ArrayList<>();
    private ParsedDraftView currentDraft;

    public MaterialView getMaterial() {
        return material;
    }

    public void setMaterial(MaterialView material) {
        this.material = material;
    }

    public List<MaterialVersionView> getVersions() {
        return versions;
    }

    public void setVersions(List<MaterialVersionView> versions) {
        this.versions = versions;
    }

    public ParsedDraftView getCurrentDraft() {
        return currentDraft;
    }

    public void setCurrentDraft(ParsedDraftView currentDraft) {
        this.currentDraft = currentDraft;
    }
}
