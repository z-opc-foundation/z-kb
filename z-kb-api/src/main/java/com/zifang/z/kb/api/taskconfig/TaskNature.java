package com.zifang.z.kb.api.taskconfig;

/**
 * 任务性质：文档编译与 Wiki 生成属于处理链路，测评跑批属于最终 QA。
 *
 * <p>采集同步/图谱抽取等没有独立执行单元，不单列为任务性质。</p>
 */
public enum TaskNature {

    COMPILE("文档编译", "CHAIN", 1),
    WIKI("Wiki 生成", "CHAIN", 2),
    EVALUATION("测评跑批", "QA", 3);

    private final String label;
    private final String group;
    private final int order;

    TaskNature(String label, String group, int order) {
        this.label = label;
        this.group = group;
        this.order = order;
    }

    public String getLabel() {
        return label;
    }

    public String getGroup() {
        return group;
    }

    public int getOrder() {
        return order;
    }

    public static TaskNature of(String value) {
        if (value == null) {
            return null;
        }
        for (TaskNature nature : values()) {
            if (nature.name().equals(value.trim())) {
                return nature;
            }
        }
        return null;
    }
}
