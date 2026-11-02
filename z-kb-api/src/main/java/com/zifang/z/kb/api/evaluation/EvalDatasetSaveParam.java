package com.zifang.z.kb.api.evaluation;

import java.util.ArrayList;
import java.util.List;

/**
 * 数据集草稿保存参数。
 */
public class EvalDatasetSaveParam {

    private String kbId;
    private String name;
    private String description;
    private List<EvalCaseInputParam> cases = new ArrayList<>();

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public List<EvalCaseInputParam> getCases() {
        return cases;
    }

    public void setCases(List<EvalCaseInputParam> cases) {
        this.cases = cases;
    }
}
