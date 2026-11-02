package com.zifang.z.kb.api.taskconfig;

import com.zifang.z.kb.api.resource.KbCaller;

/**
 * 租户级任务配置：覆盖全部任务性质的整版发布，只影响之后创建的任务。
 */
public interface TaskConfigService {

    TaskConfigPanelView query(KbCaller caller);

    TaskConfigPanelView publish(TaskConfigPublishParam param, KbCaller caller);
}
