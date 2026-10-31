package com.zifang.z.kb.api.wiki;

import java.util.ArrayList;
import java.util.List;

/**
 * 批量生成结果：逐条状态与汇总计数。
 */
public class WikiGenerateResultView {

    private int totalCount;
    private int successCount;
    private int failedCount;
    private List<WikiGenerateItemView> items = new ArrayList<>();

    public int getTotalCount() {
        return totalCount;
    }

    public void setTotalCount(int totalCount) {
        this.totalCount = totalCount;
    }

    public int getSuccessCount() {
        return successCount;
    }

    public void setSuccessCount(int successCount) {
        this.successCount = successCount;
    }

    public int getFailedCount() {
        return failedCount;
    }

    public void setFailedCount(int failedCount) {
        this.failedCount = failedCount;
    }

    public List<WikiGenerateItemView> getItems() {
        return items;
    }

    public void setItems(List<WikiGenerateItemView> items) {
        this.items = items;
    }
}
