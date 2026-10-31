package com.zifang.z.kb.core.source;

import java.util.ArrayList;
import java.util.List;

/**
 * 一次接入源同步的计数与失败明细。未变表示来源侧正文没有变化，跳过下载与登记；
 * 失效表示来源侧已不存在、本次被标记删除的物料。
 */
public class IngestSyncInfo {

    private static final int MAX_FAILURES = 20;

    private int created;
    private int updated;
    private int unchanged;
    private int skipped;
    private int retired;
    private int failed;

    private final List<String> failures = new ArrayList<>();

    public void markCreated() {
        created++;
    }

    public void markUpdated() {
        updated++;
    }

    public void markUnchanged() {
        unchanged++;
    }

    public void markSkipped() {
        skipped++;
    }

    public void markRetired() {
        retired++;
    }

    /** 记录一条失败；明细只保留前 20 条，计数照常累加。 */
    public void markFailed(String detail) {
        failed++;
        if (failures.size() < MAX_FAILURES && detail != null) {
            failures.add(detail);
        }
    }

    /** 一行摘要，直接作为任务结果与接口回执。 */
    public String getSummary() {
        StringBuilder builder = new StringBuilder();
        builder.append("新增 ").append(created)
                .append(" · 更新 ").append(updated)
                .append(" · 未变 ").append(unchanged);
        if (skipped > 0) {
            builder.append(" · 跳过 ").append(skipped);
        }
        builder.append(" · 失效 ").append(retired)
                .append(" · 失败 ").append(failed);
        return builder.toString();
    }

    public int total() {
        return created + updated + unchanged + skipped + retired + failed;
    }

    public int getCreated() {
        return created;
    }

    public int getUpdated() {
        return updated;
    }

    public int getUnchanged() {
        return unchanged;
    }

    public int getSkipped() {
        return skipped;
    }

    public int getRetired() {
        return retired;
    }

    public int getFailed() {
        return failed;
    }

    public List<String> getFailures() {
        return failures;
    }
}
