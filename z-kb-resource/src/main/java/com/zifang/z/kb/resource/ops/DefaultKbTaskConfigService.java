package com.zifang.z.kb.resource.ops;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBaseAction;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.resource.KnowledgeBaseView;
import com.zifang.z.kb.api.taskconfig.KbTaskConfigService;
import com.zifang.z.kb.api.taskconfig.TaskConfigItemParam;
import com.zifang.z.kb.api.taskconfig.TaskConfigPanelView;
import com.zifang.z.kb.api.taskconfig.TaskConfigPublishParam;
import com.zifang.z.kb.resource.KbAuditService;
import com.zifang.z.kb.storage.taskconfig.entity.TaskConfigEntity;
import com.zifang.z.kb.storage.taskconfig.mapper.TaskConfigMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 知识库级任务配置：库内覆盖优先，未覆盖时回落租户当前版本。
 */
public class DefaultKbTaskConfigService implements KbTaskConfigService {

    private final TaskConfigMapper taskConfigMapper;

    private final DefaultTaskConfigService tenantConfigService;

    private final KnowledgeBaseResourceService resourceService;

    private final KbAuditService auditService;

    public DefaultKbTaskConfigService(TaskConfigMapper taskConfigMapper,
                                      DefaultTaskConfigService tenantConfigService,
                                      KnowledgeBaseResourceService resourceService,
                                      KbAuditService auditService) {
        this.taskConfigMapper = taskConfigMapper;
        this.tenantConfigService = tenantConfigService;
        this.resourceService = resourceService;
        this.auditService = auditService;
    }

    @Override
    public TaskConfigPanelView query(String kbId, KbCaller caller) {
        KnowledgeBaseView kb = resourceService.requireReadable(kbId, caller);
        return currentPanel(kb, caller);
    }

    @Override
    public TaskConfigPanelView publish(String kbId, TaskConfigPublishParam param,
                                       KbCaller caller) {
        KnowledgeBaseView kb = resourceService.requireActionable(kbId,
                KnowledgeBaseAction.KB_MANAGE, caller);
        if (param == null) {
            throw TaskConfigSupport.paramInvalid();
        }
        List<TaskConfigItemParam> items = TaskConfigSupport.validate(param.getItems());
        String tenantCode = caller.getTenantCode();
        String latest = latestVersion(tenantCode, kb.getKbId());
        String baseVersion = latest != null ? latest : currentPanel(kb, caller).getVersion();
        String nextVersion = TaskConfigSupport.nextVersion(baseVersion);
        Instant now = Instant.now();
        List<TaskConfigEntity> rows = new ArrayList<>();
        for (TaskConfigItemParam item : items) {
            TaskConfigEntity row = TaskConfigSupport.buildRow(tenantCode, kb.getKbId(),
                    nextVersion, item, now, caller.getActorId());
            taskConfigMapper.insert(row);
            rows.add(row);
        }
        auditService.record(caller, kb.getKbId(), "kb.task.config.publish", "TASK_CONFIG",
                nextVersion, "发布知识库任务配置 " + nextVersion);
        return TaskConfigSupport.toPanel(rows);
    }

    private TaskConfigPanelView currentPanel(KnowledgeBaseView kb, KbCaller caller) {
        String tenantCode = caller.getTenantCode();
        String version = latestVersion(tenantCode, kb.getKbId());
        if (version == null) {
            return tenantConfigService.currentPanel(caller);
        }
        return TaskConfigSupport.toPanel(listByVersion(tenantCode, kb.getKbId(), version));
    }

    private String latestVersion(String tenantCode, String kbId) {
        TaskConfigEntity latest = taskConfigMapper.selectOne(
                new QueryWrapper<TaskConfigEntity>()
                        .eq("tenant_code", tenantCode)
                        .eq("kb_id", kbId)
                        .eq("is_deleted", 0)
                        .orderByDesc("published_at")
                        .orderByDesc("create_time")
                        .last("LIMIT 1"));
        return latest == null ? null : latest.getConfigVersion();
    }

    private List<TaskConfigEntity> listByVersion(String tenantCode, String kbId, String version) {
        return taskConfigMapper.selectList(
                new QueryWrapper<TaskConfigEntity>()
                        .eq("tenant_code", tenantCode)
                        .eq("kb_id", kbId)
                        .eq("config_version", version)
                        .eq("is_deleted", 0));
    }
}
