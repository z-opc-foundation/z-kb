package com.zifang.z.***REMOVED***.web.api.v1.dto;

import com.zifang.z.***REMOVED***.api.taskconfig.TaskConfigItemParam;
import com.zifang.z.***REMOVED***.api.taskconfig.TaskConfigPublishParam;

import java.util.ArrayList;
import java.util.List;

/**
 * 知识库级任务配置整版发布请求。
 */
public class ***REMOVED***TaskConfigPublishRequest {

    private String ***REMOVED***Id;
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

    public String get***REMOVED***Id() {
        return ***REMOVED***Id;
    }

    public void set***REMOVED***Id(String ***REMOVED***Id) {
        this.***REMOVED***Id = ***REMOVED***Id;
    }

    public List<TaskConfigPublishItemRequest> getItems() {
        return items;
    }

    public void setItems(List<TaskConfigPublishItemRequest> items) {
        this.items = items;
    }
}
