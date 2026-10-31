package com.zifang.z.kb.resource.ops;

import com.zifang.util.json.JsonUtil;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.taskconfig.TaskConfigItemParam;
import com.zifang.z.kb.api.taskconfig.TaskConfigItemView;
import com.zifang.z.kb.api.taskconfig.TaskConfigPanelView;
import com.zifang.z.kb.api.taskconfig.TaskNature;
import com.zifang.z.kb.storage.taskconfig.entity.TaskConfigEntity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 任务配置的校验、落行与回显规则，租户级与库级共用。
 */
final class TaskConfigSupport {

    static final String INITIAL_VERSION = "2026.10";

    private static final String NEXT_VERSION_PREFIX = "2026.10-r";

    private static final int MAX_TIMEOUT_SECONDS = 86_400;

    private static final int MAX_RETRY_LIMIT = 5;

    private TaskConfigSupport() {
    }

    /** 校验发布项：必须恰好覆盖且不重复所有任务性质，并检查必填、字段长度、超时与重试范围。 */
    static List<TaskConfigItemParam> validate(List<TaskConfigItemParam> items) {
        if (items == null || items.size() != TaskNature.values().length) {
            throw natureMissing();
        }
        Set<String> seen = new HashSet<>();
        for (TaskConfigItemParam item : items) {
            TaskNature nature = item == null ? null : TaskNature.of(item.getTaskNature());
            if (nature == null || !seen.add(nature.name())) {
                throw natureMissing();
            }
            if (!hasText(item.getExecutionMode()) || !hasText(item.getExecutor())) {
                throw paramInvalid();
            }
            checkLength(item.getExecutionMode(), 32);
            checkLength(item.getExecutor(), 128);
            checkLength(item.getAgentCode(), 128);
            checkLength(item.getModel(), 128);
            checkLength(item.getSkills(), 500);
            checkLength(item.getTools(), 500);
            checkLength(item.getPromptVersion(), 128);
            checkLength(item.getOutputContract(), 255);
            checkLength(item.getBoundaryNote(), 500);
            Integer timeout = item.getTimeoutSeconds();
            if (timeout == null || timeout <= 0 || timeout > MAX_TIMEOUT_SECONDS) {
                throw paramInvalid();
            }
            Integer retry = item.getRetryLimit();
            if (retry == null || retry < 0 || retry > MAX_RETRY_LIMIT) {
                throw paramInvalid();
            }
        }
        List<TaskConfigItemParam> sorted = new ArrayList<>(items);
        sorted.sort(Comparator.comparingInt(item -> TaskNature.of(item.getTaskNature()).getOrder()));
        return sorted;
    }

    /** 计算下一版本号：初始版升为 r2，修订版序号加一。 */
    static String nextVersion(String current) {
        if (!hasText(current)) {
            return INITIAL_VERSION;
        }
        String value = current.trim();
        if (INITIAL_VERSION.equals(value)) {
            return NEXT_VERSION_PREFIX + "2";
        }
        if (value.startsWith(NEXT_VERSION_PREFIX)) {
            try {
                int serial = Integer.parseInt(value.substring(NEXT_VERSION_PREFIX.length()));
                return NEXT_VERSION_PREFIX + (serial + 1);
            } catch (NumberFormatException e) {
                throw new KBException("TASK_CONFIG_VERSION_INVALID", "任务配置版本不合法");
            }
        }
        return INITIAL_VERSION;
    }

    /** 按任务性质生成一条默认配置行。 */
    static TaskConfigEntity defaultRow(String tenantCode, String kbId, TaskNature nature,
                                       Instant now, String actorId) {
        TaskConfigItemView item = new TaskConfigItemView();
        item.setTaskNature(nature.name());
        item.setTaskLabel(nature.getLabel());
        item.setTaskGroup(nature.getGroup());
        switch (nature) {
            case COMPILE:
                fill(item, "LOCAL_PIPELINE", "kb-compiler", "—", "—", "解析稿复用、标题切块",
                        "chunker", "text-simple@1.0", "retrieval_chunk", 300, 1,
                        "索引后执行本地规则萃取（摘要/问句/术语/FAQ），产物不入账本。");
                break;
            case WIKI:
                fill(item, "LOCAL_PIPELINE", "wiki-generator", "wiki_compiler", "—",
                        "Wiki 确定性生成流水线", "knowledge_search", "wiki-compile@1.0",
                        "wiki_page", 1800, 1,
                        "按已解析正文确定性生成多页 Wiki；单条失败不阻断其他资料。");
                break;
            case EVALUATION:
            default:
                fill(item, "BATCH", "evaluation-runner", "—", "—", "按评测集跑批",
                        "evaluation-runner", "—", "evaluation_run", 1800, 1,
                        "同步本地确定性跑批，固定数据集与索引代际。");
                break;
        }
        return buildRow(tenantCode, kbId, INITIAL_VERSION, item, now, actorId);
    }

    /** 按发布项生成一行。 */
    static TaskConfigEntity buildRow(String tenantCode, String kbId, String version,
                                     TaskConfigItemParam param, Instant now, String actorId) {
        TaskNature nature = TaskNature.of(param.getTaskNature());
        TaskConfigItemView item = new TaskConfigItemView();
        item.setTaskNature(nature.name());
        item.setTaskLabel(nature.getLabel());
        item.setTaskGroup(nature.getGroup());
        item.setExecutionMode(trim(param.getExecutionMode()));
        item.setExecutor(trim(param.getExecutor()));
        item.setAgentCode(trimOrDash(param.getAgentCode()));
        item.setModel(trimOrDash(param.getModel()));
        item.setSkills(trim(param.getSkills()));
        item.setTools(trim(param.getTools()));
        item.setPromptVersion(trimOrDash(param.getPromptVersion()));
        item.setOutputContract(trim(param.getOutputContract()));
        item.setTimeoutSeconds(param.getTimeoutSeconds());
        item.setRetryLimit(param.getRetryLimit());
        item.setBoundaryNote(trim(param.getBoundaryNote()));
        return buildRow(tenantCode, kbId, version, item, now, actorId);
    }

    /** 组装面板：版本与发布时间取首行，条目按任务性质顺序排列。 */
    static TaskConfigPanelView toPanel(List<TaskConfigEntity> rows) {
        TaskConfigPanelView panel = new TaskConfigPanelView();
        if (rows == null || rows.isEmpty()) {
            return panel;
        }
        TaskConfigEntity head = rows.get(0);
        panel.setVersion(head.getConfigVersion());
        panel.setPublishedAt(head.getPublishedAt());
        panel.setPublishedBy(head.getPublishedBy());
        List<TaskConfigItemView> items = new ArrayList<>();
        for (TaskConfigEntity row : rows) {
            if (TaskNature.of(row.getTaskCode()) != null) {
                items.add(toItem(row));
            }
        }
        items.sort(Comparator.comparingInt(item -> TaskNature.of(item.getTaskNature()).getOrder()));
        panel.setItems(items);
        return panel;
    }

    private static TaskConfigEntity buildRow(String tenantCode, String kbId, String version,
                                             TaskConfigItemView item, Instant now,
                                             String actorId) {
        TaskConfigEntity row = new TaskConfigEntity();
        row.setId(UUID.randomUUID().toString());
        row.setTenantCode(tenantCode);
        row.setKbId(kbId == null ? "" : kbId);
        row.setTaskType(item.getTaskGroup());
        row.setTaskCode(item.getTaskNature());
        row.setTaskName(item.getTaskLabel());
        row.setConfigVersion(version);
        row.setExecutorConfig(toExecutorConfig(item));
        row.setPublishedAt(now);
        row.setPublishedBy(actorId);
        row.setIsDeleted(0);
        row.setCreateBy(actorId);
        row.setUpdateBy(actorId);
        row.setCreateTime(now);
        row.setUpdateTime(now);
        return row;
    }

    private static TaskConfigItemView toItem(TaskConfigEntity row) {
        TaskConfigItemView item = new TaskConfigItemView();
        item.setTaskNature(row.getTaskCode());
        item.setTaskLabel(row.getTaskName());
        item.setTaskGroup(row.getTaskType());
        Map<String, Object> payload = parseObject(row.getExecutorConfig());
        Map<String, Object> params = asMap(payload.get("params"));
        item.setExecutor(text(payload, "executor", ""));
        item.setExecutionMode(text(params, "executionMode", ""));
        item.setAgentCode(text(params, "agentCode", "—"));
        item.setModel(text(params, "model", "—"));
        item.setSkills(text(params, "skills", ""));
        item.setTools(text(params, "tools", ""));
        item.setPromptVersion(text(params, "promptVersion", "—"));
        item.setOutputContract(text(params, "outputContract", ""));
        item.setTimeoutSeconds(intValue(params.get("timeoutSeconds")));
        item.setRetryLimit(intValue(params.get("retryLimit")));
        item.setBoundaryNote(text(params, "boundaryNote", ""));
        return item;
    }

    private static String toExecutorConfig(TaskConfigItemView item) {
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("executionMode", item.getExecutionMode());
        params.put("agentCode", item.getAgentCode());
        params.put("model", item.getModel());
        params.put("skills", item.getSkills());
        params.put("tools", item.getTools());
        params.put("promptVersion", item.getPromptVersion());
        params.put("outputContract", item.getOutputContract());
        params.put("timeoutSeconds", item.getTimeoutSeconds());
        params.put("retryLimit", item.getRetryLimit());
        params.put("boundaryNote", item.getBoundaryNote());
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("executor", item.getExecutor());
        payload.put("executorType", "AGENT".equals(item.getExecutionMode()) ? "AGENT" : "CODE");
        payload.put("params", params);
        return JsonUtil.toJson(payload);
    }

    private static void fill(TaskConfigItemView item, String executionMode, String executor,
                             String agentCode, String model, String skills, String tools,
                             String promptVersion, String outputContract, int timeoutSeconds,
                             int retryLimit, String boundaryNote) {
        item.setExecutionMode(executionMode);
        item.setExecutor(executor);
        item.setAgentCode(agentCode);
        item.setModel(model);
        item.setSkills(skills);
        item.setTools(tools);
        item.setPromptVersion(promptVersion);
        item.setOutputContract(outputContract);
        item.setTimeoutSeconds(timeoutSeconds);
        item.setRetryLimit(retryLimit);
        item.setBoundaryNote(boundaryNote);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> parseObject(String json) {
        if (!hasText(json)) {
            return new LinkedHashMap<>();
        }
        try {
            Object plain = JsonUtil.toPlainValue(JsonUtil.parse(json));
            if (plain instanceof Map) {
                return new LinkedHashMap<>((Map<String, Object>) plain);
            }
        } catch (RuntimeException ignored) {
            // 历史脏数据按空配置回显，不让读取路径失败
        }
        return new LinkedHashMap<>();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object value) {
        return value instanceof Map ? (Map<String, Object>) value : new LinkedHashMap<>();
    }

    private static String text(Map<String, Object> map, String key, String fallback) {
        Object value = map.get(key);
        if (value == null || !hasText(String.valueOf(value))) {
            return fallback;
        }
        return String.valueOf(value);
    }

    private static Integer intValue(Object value) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        try {
            return value == null ? 0 : Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static void checkLength(String value, int max) {
        if (value != null && value.trim().length() > max) {
            throw paramInvalid();
        }
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private static String trimOrDash(String value) {
        String trimmed = trim(value);
        return trimmed.isEmpty() ? "—" : trimmed;
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    static KBException paramInvalid() {
        return new KBException("TASK_CONFIG_PARAM_INVALID", "任务配置参数不合法");
    }

    static KBException natureMissing() {
        return new KBException("TASK_CONFIG_NATURE_MISSING", "任务配置必须覆盖全部三类任务性质");
    }
}
