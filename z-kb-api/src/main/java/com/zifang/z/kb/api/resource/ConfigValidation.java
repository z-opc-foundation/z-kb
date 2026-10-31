package com.zifang.z.kb.api.resource;

import java.util.ArrayList;
import java.util.List;

/**
 * 配置草稿校验结果。
 */
public class ConfigValidation {

    private boolean valid;
    private int changedCount;
    private List<ConfigIssue> items = new ArrayList<>();

    public boolean isValid() {
        return valid;
    }

    public void setValid(boolean valid) {
        this.valid = valid;
    }

    public int getChangedCount() {
        return changedCount;
    }

    public void setChangedCount(int changedCount) {
        this.changedCount = changedCount;
    }

    public List<ConfigIssue> getItems() {
        return items;
    }

    public void setItems(List<ConfigIssue> items) {
        this.items = items;
    }
}
