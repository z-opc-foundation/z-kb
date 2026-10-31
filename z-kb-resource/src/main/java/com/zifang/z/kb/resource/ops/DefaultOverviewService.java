package com.zifang.z.kb.resource.ops;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.overview.OverviewService;
import com.zifang.z.kb.api.overview.OverviewView;
import com.zifang.z.kb.api.overview.WikiPageCounter;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.storage.compilation.entity.CompilationJobEntity;
import com.zifang.z.kb.storage.compilation.mapper.CompilationJobMapper;
import com.zifang.z.kb.storage.material.entity.MaterialEntity;
import com.zifang.z.kb.storage.material.mapper.MaterialMapper;

import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 知识库概览聚合：物料数、已编译/部分编译/未编译数、Wiki 数、运行中与失败任务数及最近物料。
 *
 * <p>「已编译」按当前物料版本是否收敛到 M1/M2 判定，旧版本的编译不重复计入。</p>
 */
public class DefaultOverviewService implements OverviewService {

    private static final int RECENT_LIMIT = 5;

    private static final int JOB_SCAN_LIMIT = 2000;

    private final KnowledgeBaseResourceService resourceService;

    private final MaterialService materialService;

    private final MaterialMapper materialMapper;

    private final CompilationJobMapper compilationJobMapper;

    private final List<WikiPageCounter> wikiPageCounters;

    public DefaultOverviewService(KnowledgeBaseResourceService resourceService,
                                  MaterialService materialService,
                                  MaterialMapper materialMapper,
                                  CompilationJobMapper compilationJobMapper,
                                  List<WikiPageCounter> wikiPageCounters) {
        this.resourceService = resourceService;
        this.materialService = materialService;
        this.materialMapper = materialMapper;
        this.compilationJobMapper = compilationJobMapper;
        this.wikiPageCounters = wikiPageCounters == null ? List.of() : wikiPageCounters;
    }

    @Override
    public OverviewView kbStats(String kbId, KbCaller caller) {
        String kb = resourceService.requireReadable(kbId, caller).getKbId();
        String tenantCode = caller.getTenantCode();

        List<MaterialEntity> materials = materialMapper.selectList(
                new QueryWrapper<MaterialEntity>()
                        .eq("tenant_code", tenantCode)
                        .eq("kb_id", kb)
                        .eq("is_deleted", 0));
        Map<String, String> currentVersions = new HashMap<>();
        for (MaterialEntity material : materials) {
            currentVersions.put(material.getMaterialId(), material.getCurrentVersionId());
        }

        Map<String, String> milestones = currentVersionMilestones(tenantCode, kb, currentVersions);
        long compiled = 0L;
        long partial = 0L;
        for (String milestone : milestones.values()) {
            if ("M2".equals(milestone)) {
                compiled++;
            } else if ("M1".equals(milestone)) {
                partial++;
            }
        }

        OverviewView view = new OverviewView();
        view.setKbId(kb);
        view.setFileCount(materials.size());
        view.setCompiledCount(compiled);
        view.setPartialCount(partial);
        view.setNotCompiledCount(Math.max(0L, materials.size() - compiled - partial));
        view.setWikiCount(wikiCount(tenantCode, kb));
        view.setRunningTaskCount(countJobs(tenantCode, kb, "QUEUED", "RUNNING"));
        view.setFailedCount(countJobs(tenantCode, kb, "FAILED"));
        view.setRecentMaterials(materialService.listRecent(kb, RECENT_LIMIT, caller));
        view.setRefreshedAt(Instant.now());
        return view;
    }

    /** 每个当前物料版本收敛到的最好里程碑：M2 优先，其次 M1。 */
    private Map<String, String> currentVersionMilestones(String tenantCode, String kbId,
                                                         Map<String, String> currentVersions) {
        Map<String, String> result = new LinkedHashMap<>();
        List<CompilationJobEntity> jobs = compilationJobMapper.selectList(
                new QueryWrapper<CompilationJobEntity>()
                        .eq("tenant_code", tenantCode)
                        .eq("kb_id", kbId)
                        .eq("is_deleted", 0)
                        .isNotNull("material_id")
                        .orderByDesc("create_time")
                        .last("LIMIT " + JOB_SCAN_LIMIT));
        for (CompilationJobEntity job : jobs) {
            String currentVersion = currentVersions.get(job.getMaterialId());
            if (currentVersion == null || !currentVersion.equals(job.getMaterialVersionId())) {
                continue;
            }
            String milestone = job.getMilestone();
            if (!"M1".equals(milestone) && !"M2".equals(milestone)) {
                continue;
            }
            String existing = result.get(job.getMaterialId());
            if (existing == null || "M2".equals(milestone)) {
                result.put(job.getMaterialId(), milestone);
            }
        }
        return result;
    }

    private long countJobs(String tenantCode, String kbId, String... statuses) {
        Long total = compilationJobMapper.selectCount(new QueryWrapper<CompilationJobEntity>()
                .eq("tenant_code", tenantCode)
                .eq("kb_id", kbId)
                .eq("is_deleted", 0)
                .in("run_status", (Object[]) statuses));
        return total == null ? 0L : total;
    }

    private long wikiCount(String tenantCode, String kbId) {
        long total = 0L;
        for (WikiPageCounter counter : wikiPageCounters) {
            total += counter.countByKb(tenantCode, kbId);
        }
        return total;
    }
}
