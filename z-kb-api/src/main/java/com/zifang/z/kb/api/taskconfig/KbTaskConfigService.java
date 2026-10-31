package com.zifang.z.***REMOVED***.api.taskconfig;

import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;

/**
 * 知识库级任务配置：库内覆盖优先，未覆盖时回落租户当前版本。
 */
public interface ***REMOVED***TaskConfigService {

    TaskConfigPanelView query(String ***REMOVED***Id, ***REMOVED***Caller caller);

    TaskConfigPanelView publish(String ***REMOVED***Id, TaskConfigPublishParam param, ***REMOVED***Caller caller);
}
