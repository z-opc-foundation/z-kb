package com.zifang.z.kb.api.evaluation;

import java.util.ArrayList;
import java.util.List;

/**
 * 数据集详情：版本摘要与题目列表。
 */
public class EvaluationDatasetInfo {

    private DatasetSummaryInfo dataset;
    private List<DatasetCaseInfo> cases = new ArrayList<>();

    public DatasetSummaryInfo getDataset() {
        return dataset;
    }

    public void setDataset(DatasetSummaryInfo dataset) {
        this.dataset = dataset;
    }

    public List<DatasetCaseInfo> getCases() {
        return cases;
    }

    public void setCases(List<DatasetCaseInfo> cases) {
        this.cases = cases;
    }
}
