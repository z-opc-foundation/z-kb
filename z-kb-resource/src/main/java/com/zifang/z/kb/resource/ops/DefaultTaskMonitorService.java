package com.zifang.z.***REMOVED***.resource.ops;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.***REMOVED***.api.***REMOVED***Exception;
import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.***REMOVED***.api.taskmonitor.TaskMonitorPageView;
import com.zifang.z.***REMOVED***.api.taskmonitor.TaskMonitorService;
import com.zifang.z.***REMOVED***.api.taskmonitor.TaskMonitorSummaryView;
import com.zifang.z.***REMOVED***.api.taskmonitor.TaskMonitorView;
import com.zifang.z.***REMOVED***.storage.compilation.mapper.CompilationJobMapper;
import com.zifang.z.***REMOVED***.storage.compilation.mapper.CompilationStageMapper;
import com.zifang.z.***REMOVED***.storage.compilation.mapper.TaskMonitorRow;
import com.zifang.z.***REMOVED***.storage.compilation.entity.CompilationJobEntity;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * 调度任务监控：组别与单任务都落在编译作业上，调度任务落在编译阶段行上。
 */
public class DefaultTaskMonitorService implements TaskMonitorService {

    private static final int DEFAULT_PAGE_SIZE = 20;

    private static final int MAX_PAGE_SIZE = 100;

    private static final List<String> STATUSES = Arrays.asList("PENDING", "QUEUED", "RUNNING",
            "SUCCEEDED", "FAILED", "CANCELED", "SKIPPED");

    private final CompilationJobMapper jobMapper;

    private final CompilationStageMapper stageMapper;

    private final KnowledgeBaseResourceService resourceService;

    public DefaultTaskMonitorService(CompilationJobMapper jobMapper,
                                     CompilationStageMapper stageMapper,
                                     KnowledgeBaseResourceService resourceService) {
        this.jobMapper = jobMapper;
        this.stageMapper = stageMapper;
        this.resourceService = resourceService;
    }

    @Override
    public TaskMonitorPageView page(String ***REMOVED***Id, String taskType, String status, int pageNo,
                                    int pageSize, ***REMOVED***Caller caller) {
        String ***REMOVED*** = require***REMOVED***(***REMOVED***Id, caller);
        String type = normalizeTaskType(taskType);
        String state = normalizeStatus(status);
        int no = Math.max(1, pageNo);
        int size = pageSize <= 0 ? DEFAULT_PAGE_SIZE : Math.min(pageSize, MAX_PAGE_SIZE);

        TaskMonitorPageView view = new TaskMonitorPageView();
        view.setTotal(stageMapper.countBy***REMOVED***(caller.getTenantCode(), ***REMOVED***, type, state));
        view.setPageNo(no);
        view.setPageSize(size);
        List<TaskMonitorView> records = new ArrayList<>();
        for (TaskMonitorRow row : stageMapper.pageBy***REMOVED***(caller.getTenantCode(), ***REMOVED***, type, state,
                size, (no - 1) * size)) {
            records.add(toView(row));
        }
        view.setRecords(records);
        return view;
    }

    @Override
    public TaskMonitorSummaryView summary(String ***REMOVED***Id, ***REMOVED***Caller caller) {
        String ***REMOVED*** = require***REMOVED***(***REMOVED***Id, caller);
        TaskMonitorSummaryView view = new TaskMonitorSummaryView();
        view.setJobTotal(countJobs(caller.getTenantCode(), ***REMOVED***, false));
        view.setGroupTotal(countJobs(caller.getTenantCode(), ***REMOVED***, true));
        view.setTaskTotal(stageMapper.countBy***REMOVED***(caller.getTenantCode(), ***REMOVED***, null, null));
        return view;
    }

    private String require***REMOVED***(String ***REMOVED***Id, ***REMOVED***Caller caller) {
        if (***REMOVED***Id == null || ***REMOVED***Id.trim().isEmpty()) {
            throw new ***REMOVED***Exception("***REMOVED***PARAM_INVALID", "知识库参数不合法");
        }
        return resourceService.requireReadable(***REMOVED***Id.trim(), caller).get***REMOVED***Id();
    }

    private long countJobs(String tenantCode, String ***REMOVED***Id, boolean groupsOnly) {
        QueryWrapper<CompilationJobEntity> wrapper = new QueryWrapper<CompilationJobEntity>()
                .eq("tenant_code", tenantCode)
                .eq("***REMOVED***_id", ***REMOVED***Id)
                .eq("is_deleted", 0);
        if (groupsOnly) {
            wrapper.ne("scope_type", "SINGLE");
        }
        Long total = jobMapper.selectCount(wrapper);
        return total == null ? 0L : total;
    }

    private String normalizeTaskType(String taskType) {
        return taskType == null || taskType.trim().isEmpty()
                ? null : taskType.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeStatus(String status) {
        if (status == null || status.trim().isEmpty()) {
            return null;
        }
        String value = status.trim().toUpperCase(Locale.ROOT);
        if (!STATUSES.contains(value)) {
            throw new ***REMOVED***Exception("***REMOVED***PARAM_INVALID", "知识库参数不合法");
        }
        return value;
    }

    private TaskMonitorView toView(TaskMonitorRow row) {
        TaskMonitorView view = new TaskMonitorView();
        view.setTaskId(row.getTaskId());
        view.setTaskType(row.getTaskType());
        view.setBizKey(row.getBizKey());
        view.setStatus(row.getStatus());
        view.setAttempt(row.getAttempt());
        view.setMaxAttempts(row.getMaxAttempts());
        view.setResultSummary(row.getResultSummary());
        view.setFailureSummary(row.getFailureSummary());
        view.setMaterialId(row.getMaterialId());
        view.setMaterialTitle(row.getMaterialTitle());
        view.setCreateTime(row.getCreateTime());
        view.setStartedAt(row.getStartedAt());
        view.setFinishedAt(row.getFinishedAt());
        return view;
    }
}
