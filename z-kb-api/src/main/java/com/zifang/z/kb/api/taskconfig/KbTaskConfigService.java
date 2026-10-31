package com.zifang.z.kb.api.taskconfig;

import com.zifang.z.kb.api.resource.KbCaller;

/**
 * 知识库级任务配置：库内覆盖优先，未覆盖时回落租户当前版本。
 */
public interface KbTaskConfigService {

    TaskConfigPanelView query(String kbId, KbCaller caller);

    TaskConfigPanelView publish(String kbId, TaskConfigPublishParam param, KbCaller caller);
}
