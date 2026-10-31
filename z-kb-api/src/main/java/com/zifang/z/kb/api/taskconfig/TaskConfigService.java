package com.zifang.z.***REMOVED***.api.taskconfig;

import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;

/**
 * 租户级任务配置：覆盖全部任务性质的整版发布，只影响之后创建的任务。
 */
public interface TaskConfigService {

    TaskConfigPanelView query(***REMOVED***Caller caller);

    TaskConfigPanelView publish(TaskConfigPublishParam param, ***REMOVED***Caller caller);
}
