package com.zifang.z.kb.web.api.v1.dto;

import com.zifang.z.kb.api.taskconfig.TaskConfigItemParam;
import com.zifang.z.kb.api.taskconfig.TaskConfigPublishParam;

import java.util.ArrayList;
import java.util.List;

/**
 * 知识库级任务配置整版发布请求。
 */
public class KbTaskConfigPublishRequest {

    private String kbId;
    private List<TaskConfigPublishItemRequest> items = new ArrayList<>();

    public TaskConfigPublishParam toParam() {
        TaskConfigPublishParam param = new TaskConfigPublishParam();
        List<TaskConfigItemParam> target = new ArrayList<>();
        for (TaskConfigPublishItemRequest item : items) {
            target.add(item.toParam());
        }
        param.setItems(target);
        return param;
    }

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public List<TaskConfigPublishItemRequest> getItems() {
        return items;
    }

    public void setItems(List<TaskConfigPublishItemRequest> items) {
        this.items = items;
    }
}
