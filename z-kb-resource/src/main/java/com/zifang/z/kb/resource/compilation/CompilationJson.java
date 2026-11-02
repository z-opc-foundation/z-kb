package com.zifang.z.kb.resource.compilation;

import com.zifang.util.json.JsonUtil;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 编译作业两份快照的读写：task_config 存任务身份，input_snapshot 存冻结的输入清单。
 * 发起与展示共用同一份形状，字段改名不会出现两处口径。
 */
final class CompilationJson {

    private CompilationJson() {
    }

    static String taskConfig(String taskCode, String taskName, String taskType,
                             String configVersion) {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("taskCode", taskCode);
        node.put("taskName", truncate(taskName, 64));
        node.put("taskType", taskType);
        node.put("configVersion", configVersion);
        return JsonUtil.toJson(node);
    }

    static TaskMeta taskMeta(String json) {
        Map<String, Object> node = readObject(json);
        return new TaskMeta(text(node.get("taskCode")), text(node.get("taskName")),
                text(node.get("taskType")), text(node.get("configVersion")));
    }

    static String inputSnapshot(List<ScopeEntry> entries) {
        List<Map<String, Object>> array = new ArrayList<>();
        for (ScopeEntry entry : entries) {
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("materialId", entry.getMaterialId());
            node.put("versionId", entry.getVersionId());
            node.put("title", truncate(entry.getTitle(), 255));
            node.put("versionNo", entry.getVersionNo());
            array.add(node);
        }
        return JsonUtil.toJson(array);
    }

    static List<ScopeEntry> entries(String inputSnapshot) {
        List<ScopeEntry> entries = new ArrayList<>();
        Object plain = parse(inputSnapshot);
        if (!(plain instanceof List)) {
            return entries;
        }
        for (Object item : (List<?>) plain) {
            if (!(item instanceof Map)) {
                continue;
            }
            Map<?, ?> node = (Map<?, ?>) item;
            String materialId = text(node.get("materialId"));
            if (materialId.isEmpty()) {
                continue;
            }
            entries.add(new ScopeEntry(materialId, text(node.get("versionId")),
                    text(node.get("title")), integer(node.get("versionNo"))));
        }
        return entries;
    }

    private static Object parse(String json) {
        if (json == null || json.trim().isEmpty()) {
            return null;
        }
        try {
            return JsonUtil.toPlainValue(JsonUtil.parse(json));
        } catch (RuntimeException e) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> readObject(String json) {
        Object plain = parse(json);
        if (plain instanceof Map) {
            return (Map<String, Object>) plain;
        }
        return new LinkedHashMap<>();
    }

    private static String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static Integer integer(Object value) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value == null) {
            return null;
        }
        try {
            return Integer.valueOf(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    /** 任务身份快照的四个字段。 */
    static final class TaskMeta {

        private final String taskCode;
        private final String taskName;
        private final String taskType;
        private final String configVersion;

        private TaskMeta(String taskCode, String taskName, String taskType,
                         String configVersion) {
            this.taskCode = taskCode;
            this.taskName = taskName;
            this.taskType = taskType;
            this.configVersion = configVersion;
        }

        String getTaskCode() {
            return taskCode;
        }

        String getTaskName() {
            return taskName;
        }

        String getTaskType() {
            return taskType;
        }

        String getConfigVersion() {
            return configVersion;
        }
    }

    /** 冻结清单条目。 */
    static final class ScopeEntry {

        private final String materialId;
        private final String versionId;
        private final String title;
        private final Integer versionNo;

        ScopeEntry(String materialId, String versionId, String title, Integer versionNo) {
            this.materialId = materialId;
            this.versionId = versionId;
            this.title = title;
            this.versionNo = versionNo;
        }

        String getMaterialId() {
            return materialId;
        }

        String getVersionId() {
            return versionId;
        }

        String getTitle() {
            return title;
        }

        Integer getVersionNo() {
            return versionNo;
        }
    }
}
