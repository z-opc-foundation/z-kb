package com.zifang.z.***REMOVED***.resource.ops;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseAction;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseView;
import com.zifang.z.***REMOVED***.api.taskconfig.***REMOVED***TaskConfigService;
import com.zifang.z.***REMOVED***.api.taskconfig.TaskConfigItemParam;
import com.zifang.z.***REMOVED***.api.taskconfig.TaskConfigPanelView;
import com.zifang.z.***REMOVED***.api.taskconfig.TaskConfigPublishParam;
import com.zifang.z.***REMOVED***.resource.***REMOVED***AuditService;
import com.zifang.z.***REMOVED***.storage.taskconfig.entity.TaskConfigEntity;
import com.zifang.z.***REMOVED***.storage.taskconfig.mapper.TaskConfigMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 知识库级任务配置：库内覆盖优先，未覆盖时回落租户当前版本。
 */
public class Default***REMOVED***TaskConfigService implements ***REMOVED***TaskConfigService {

    private final TaskConfigMapper taskConfigMapper;

    private final DefaultTaskConfigService tenantConfigService;

    private final KnowledgeBaseResourceService resourceService;

    private final ***REMOVED***AuditService auditService;

    public Default***REMOVED***TaskConfigService(TaskConfigMapper taskConfigMapper,
                                      DefaultTaskConfigService tenantConfigService,
                                      KnowledgeBaseResourceService resourceService,
                                      ***REMOVED***AuditService auditService) {
        this.taskConfigMapper = taskConfigMapper;
        this.tenantConfigService = tenantConfigService;
        this.resourceService = resourceService;
        this.auditService = auditService;
    }

    @Override
    public TaskConfigPanelView query(String ***REMOVED***Id, ***REMOVED***Caller caller) {
        KnowledgeBaseView ***REMOVED*** = resourceService.requireReadable(***REMOVED***Id, caller);
        return currentPanel(***REMOVED***, caller);
    }

    @Override
    public TaskConfigPanelView publish(String ***REMOVED***Id, TaskConfigPublishParam param,
                                       ***REMOVED***Caller caller) {
        KnowledgeBaseView ***REMOVED*** = resourceService.requireActionable(***REMOVED***Id,
                KnowledgeBaseAction.***REMOVED***MANAGE, caller);
        if (param == null) {
            throw TaskConfigSupport.paramInvalid();
        }
        List<TaskConfigItemParam> items = TaskConfigSupport.validate(param.getItems());
        String tenantCode = caller.getTenantCode();
        String latest = latestVersion(tenantCode, ***REMOVED***.get***REMOVED***Id());
        String baseVersion = latest != null ? latest : currentPanel(***REMOVED***, caller).getVersion();
        String nextVersion = TaskConfigSupport.nextVersion(baseVersion);
        Instant now = Instant.now();
        List<TaskConfigEntity> rows = new ArrayList<>();
        for (TaskConfigItemParam item : items) {
            TaskConfigEntity row = TaskConfigSupport.buildRow(tenantCode, ***REMOVED***.get***REMOVED***Id(),
                    nextVersion, item, now, caller.getActorId());
            taskConfigMapper.insert(row);
            rows.add(row);
        }
        auditService.record(caller, ***REMOVED***.get***REMOVED***Id(), "***REMOVED***.task.config.publish", "TASK_CONFIG",
                nextVersion, "发布知识库任务配置 " + nextVersion);
        return TaskConfigSupport.toPanel(rows);
    }

    private TaskConfigPanelView currentPanel(KnowledgeBaseView ***REMOVED***, ***REMOVED***Caller caller) {
        String tenantCode = caller.getTenantCode();
        String version = latestVersion(tenantCode, ***REMOVED***.get***REMOVED***Id());
        if (version == null) {
            return tenantConfigService.currentPanel(caller);
        }
        return TaskConfigSupport.toPanel(listByVersion(tenantCode, ***REMOVED***.get***REMOVED***Id(), version));
    }

    private String latestVersion(String tenantCode, String ***REMOVED***Id) {
        TaskConfigEntity latest = taskConfigMapper.selectOne(
                new QueryWrapper<TaskConfigEntity>()
                        .eq("tenant_code", tenantCode)
                        .eq("***REMOVED***_id", ***REMOVED***Id)
                        .eq("is_deleted", 0)
                        .orderByDesc("published_at")
                        .orderByDesc("create_time")
                        .last("LIMIT 1"));
        return latest == null ? null : latest.getConfigVersion();
    }

    private List<TaskConfigEntity> listByVersion(String tenantCode, String ***REMOVED***Id, String version) {
        return taskConfigMapper.selectList(
                new QueryWrapper<TaskConfigEntity>()
                        .eq("tenant_code", tenantCode)
                        .eq("***REMOVED***_id", ***REMOVED***Id)
                        .eq("config_version", version)
                        .eq("is_deleted", 0));
    }
}
