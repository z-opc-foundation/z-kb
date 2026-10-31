package com.zifang.z.kb.resource.ops;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.taskconfig.TaskConfigItemParam;
import com.zifang.z.kb.api.taskconfig.TaskConfigPanelView;
import com.zifang.z.kb.api.taskconfig.TaskConfigPublishParam;
import com.zifang.z.kb.api.taskconfig.TaskConfigService;
import com.zifang.z.kb.api.taskconfig.TaskNature;
import com.zifang.z.kb.storage.taskconfig.entity.TaskConfigEntity;
import com.zifang.z.kb.storage.taskconfig.mapper.TaskConfigMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 租户级任务配置：首次访问落系统预置版本 2026.10，整版发布只影响之后创建的任务。
 */
public class DefaultTaskConfigService implements TaskConfigService {

    private static final String KB_ID_TENANT = "";

    private final TaskConfigMapper taskConfigMapper;

    public DefaultTaskConfigService(TaskConfigMapper taskConfigMapper) {
        this.taskConfigMapper = taskConfigMapper;
    }

    @Override
    public TaskConfigPanelView query(KbCaller caller) {
        return currentPanel(caller);
    }

    @Override
    public TaskConfigPanelView publish(TaskConfigPublishParam param, KbCaller caller) {
        if (param == null) {
            throw TaskConfigSupport.paramInvalid();
        }
        List<TaskConfigItemParam> items = TaskConfigSupport.validate(param.getItems());
        String tenantCode = caller.getTenantCode();
        String nextVersion = TaskConfigSupport.nextVersion(latestVersion(tenantCode, KB_ID_TENANT));
        Instant now = Instant.now();
        List<TaskConfigEntity> rows = new ArrayList<>();
        for (TaskConfigItemParam item : items) {
            TaskConfigEntity row = TaskConfigSupport.buildRow(tenantCode, KB_ID_TENANT,
                    nextVersion, item, now, caller.getActorId());
            taskConfigMapper.insert(row);
            rows.add(row);
        }
        return TaskConfigSupport.toPanel(rows);
    }

    /** 取最新版本的配置行组装面板，无历史版本时写入并返回默认配置。 */
    TaskConfigPanelView currentPanel(KbCaller caller) {
        String tenantCode = caller.getTenantCode();
        String version = latestVersion(tenantCode, KB_ID_TENANT);
        List<TaskConfigEntity> rows;
        if (version == null) {
            rows = seedInitial(tenantCode, caller.getActorId());
        } else {
            rows = listByVersion(tenantCode, KB_ID_TENANT, version);
        }
        return TaskConfigSupport.toPanel(rows);
    }

    private List<TaskConfigEntity> seedInitial(String tenantCode, String actorId) {
        Instant now = Instant.now();
        List<TaskConfigEntity> rows = new ArrayList<>();
        for (TaskNature nature : TaskNature.values()) {
            TaskConfigEntity row = TaskConfigSupport.defaultRow(tenantCode, KB_ID_TENANT, nature,
                    now, actorId);
            taskConfigMapper.insert(row);
            rows.add(row);
        }
        return rows;
    }

    String latestVersion(String tenantCode, String kbId) {
        TaskConfigEntity latest = taskConfigMapper.selectOne(new QueryWrapper<TaskConfigEntity>()
                .eq("tenant_code", tenantCode)
                .eq("kb_id", kbId)
                .eq("is_deleted", 0)
                .orderByDesc("published_at")
                .orderByDesc("create_time")
                .last("LIMIT 1"));
        return latest == null ? null : latest.getConfigVersion();
    }

    List<TaskConfigEntity> listByVersion(String tenantCode, String kbId, String version) {
        return taskConfigMapper.selectList(new QueryWrapper<TaskConfigEntity>()
                .eq("tenant_code", tenantCode)
                .eq("kb_id", kbId)
                .eq("config_version", version)
                .eq("is_deleted", 0));
    }
}
