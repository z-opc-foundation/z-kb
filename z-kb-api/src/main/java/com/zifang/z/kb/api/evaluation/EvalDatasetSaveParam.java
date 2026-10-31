package com.zifang.z.***REMOVED***.api.evaluation;

import java.util.ArrayList;
import java.util.List;

/**
 * 数据集草稿保存参数。
 */
public class EvalDatasetSaveParam {

    private String ***REMOVED***Id;
    private String name;
    private String description;
    private List<EvalCaseInputParam> cases = new ArrayList<>();

    public String get***REMOVED***Id() {
        return ***REMOVED***Id;
    }

    public void set***REMOVED***Id(String ***REMOVED***Id) {
        this.***REMOVED***Id = ***REMOVED***Id;
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
