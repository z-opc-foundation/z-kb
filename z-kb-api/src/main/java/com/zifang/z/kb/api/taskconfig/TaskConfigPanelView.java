package com.zifang.z.kb.api.taskconfig;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 任务配置面板（对齐参考实现 TaskConfigPanelResponse）。
 */
public class TaskConfigPanelView {

    private String version;
    private Instant publishedAt;
    private String publishedBy;
    private List<TaskConfigItemView> items = new ArrayList<>();

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(Instant publishedAt) {
        this.publishedAt = publishedAt;
    }

    public String getPublishedBy() {
        return publishedBy;
    }

    public void setPublishedBy(String publishedBy) {
        this.publishedBy = publishedBy;
    }

    public List<TaskConfigItemView> getItems() {
        return items;
    }

    public void setItems(List<TaskConfigItemView> items) {
        this.items = items;
    }
}
