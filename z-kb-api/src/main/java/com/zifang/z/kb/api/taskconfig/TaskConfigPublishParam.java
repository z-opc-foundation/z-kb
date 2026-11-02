package com.zifang.z.kb.api.taskconfig;

import java.util.ArrayList;
import java.util.List;

/**
 * 任务配置整版发布参数。
 */
public class TaskConfigPublishParam {

    private List<TaskConfigItemParam> items = new ArrayList<>();

    public List<TaskConfigItemParam> getItems() {
        return items;
    }

    public void setItems(List<TaskConfigItemParam> items) {
        this.items = items;
    }
}
