package com.zifang.z.kb.api.taskmonitor;

/**
 * 任务管理角标汇总：组别、单任务与调度任务三类计数。
 */
public class TaskMonitorSummaryView {

    private long groupTotal;
    private long jobTotal;
    private long taskTotal;

    public long getGroupTotal() {
        return groupTotal;
    }

    public void setGroupTotal(long groupTotal) {
        this.groupTotal = groupTotal;
    }

    public long getJobTotal() {
        return jobTotal;
    }

    public void setJobTotal(long jobTotal) {
        this.jobTotal = jobTotal;
    }

    public long getTaskTotal() {
        return taskTotal;
    }

    public void setTaskTotal(long taskTotal) {
        this.taskTotal = taskTotal;
    }
}
