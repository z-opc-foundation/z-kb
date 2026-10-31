package com.zifang.z.kb.resource.compilation;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.compilation.BatchScopeType;
import com.zifang.z.kb.api.compilation.BatchStatus;
import com.zifang.z.kb.api.compilation.CompilationBatchCreateParam;
import com.zifang.z.kb.api.compilation.CompilationBatchMemberView;
import com.zifang.z.kb.api.compilation.CompilationBatchPageView;
import com.zifang.z.kb.api.compilation.CompilationBatchService;
import com.zifang.z.kb.api.compilation.CompilationBatchView;
import com.zifang.z.kb.api.compilation.CompilationScopeParam;
import com.zifang.z.kb.api.compilation.CompilationService;
import com.zifang.z.kb.api.compilation.JobRunStatus;
import com.zifang.z.kb.api.material.MaterialQuery;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.material.MaterialView;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KbPrincipalDirectory;
import com.zifang.z.kb.api.resource.KnowledgeBaseAction;
import com.zifang.z.kb.api.resource.KnowledgeBaseMemberCandidate;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.resource.PageResult;
import com.zifang.z.kb.storage.compilation.entity.CompilationJobEntity;
import com.zifang.z.kb.storage.compilation.entity.CompilationStageEntity;
import com.zifang.z.kb.storage.compilation.mapper.CompilationJobMapper;
import com.zifang.z.kb.storage.compilation.mapper.CompilationStageMapper;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.zifang.z.kb.resource.compilation.CompilationSupport.DEFAULT_BATCH_LIST;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.MAX_BATCH_LIST;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.MAX_BATCH_MEMBERS;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.batchNotFound;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.batchRunning;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.hasText;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.limit;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.paramInvalid;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.trimToNull;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.truncate;

/**
 * 编译组别编排默认实现：一个组别就是一次多文件编译作业，成员是各文件的一组阶段。
 *
 * <p>组别不单独落表，进度与状态直接读作业与阶段行；提交人姓名经
 * {@link KbPrincipalDirectory} 解析，目录不可用时留空。</p>
 */
public class DefaultCompilationBatchService implements CompilationBatchService {

    private final CompilationJobMapper jobMapper;
    private final CompilationStageMapper stageMapper;
    private final CompilationService compilationService;
    private final MaterialService materialService;
    private final KnowledgeBaseResourceService resourceService;
    private final KbPrincipalDirectory principalDirectory;

    public DefaultCompilationBatchService(
            CompilationJobMapper jobMapper,
            CompilationStageMapper stageMapper,
            CompilationService compilationService,
            MaterialService materialService,
            KnowledgeBaseResourceService resourceService,
            KbPrincipalDirectory principalDirectory) {
        this.jobMapper = jobMapper;
        this.stageMapper = stageMapper;
        this.compilationService = compilationService;
        this.materialService = materialService;
        this.resourceService = resourceService;
        this.principalDirectory = principalDirectory;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CompilationBatchView create(CompilationBatchCreateParam param, KbCaller caller) {
        if (param == null || !hasText(param.getKbId())) {
            throw paramInvalid();
        }
        String kbId = param.getKbId().trim();
        resourceService.requireActionable(kbId, KnowledgeBaseAction.COMPILATION_RUN, caller);
        String scopeType = CompilationSupport.scopeTypeOf(param.getScopeType());
        String scopeId = trimToNull(param.getScopeId());
        Set<String> materialIds = new LinkedHashSet<>();
        if (param.getMaterialIds() != null) {
            for (String materialId : param.getMaterialIds()) {
                if (hasText(materialId)) {
                    materialIds.add(materialId.trim());
                }
            }
        }
        if (materialIds.isEmpty() && scopeId != null
                && (BatchScopeType.CATEGORY.name().equals(scopeType)
                || BatchScopeType.FOLDER.name().equals(scopeType))) {
            for (MaterialView material : listScopeMaterials(kbId, scopeId, caller)) {
                if (hasText(material.getMaterialId())) {
                    materialIds.add(material.getMaterialId());
                }
            }
        }
        if (materialIds.isEmpty() || materialIds.size() > MAX_BATCH_MEMBERS) {
            throw paramInvalid();
        }
        if (countRunning(caller.getTenantCode(), kbId) > 0) {
            throw batchRunning();
        }
        CompilationScopeParam scopeParam = new CompilationScopeParam();
        scopeParam.setKbId(kbId);
        scopeParam.setName(trimToNull(param.getName()));
        scopeParam.setScopeType(scopeType);
        scopeParam.setScopeId(scopeId);
        scopeParam.setMaterialIds(new ArrayList<>(materialIds));
        CompilationJobEntity job = requireBatch(caller.getTenantCode(),
                compilationService.runScope(scopeParam, caller).getJobId());
        return toBatchView(job, true);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CompilationBatchView cancel(String batchId, KbCaller caller) {
        CompilationJobEntity job = requireBatch(caller.getTenantCode(), batchId);
        resourceService.requireActionable(job.getKbId(), KnowledgeBaseAction.COMPILATION_RUN,
                caller);
        if (!JobRunStatus.isTerminal(job.getRunStatus())) {
            compilationService.cancel(job.getJobId(), caller);
            job = requireBatch(caller.getTenantCode(), batchId);
        }
        return toBatchView(job, true);
    }

    @Override
    public CompilationBatchView query(String batchId, KbCaller caller) {
        CompilationJobEntity job = requireBatch(caller.getTenantCode(), batchId);
        resourceService.requireReadable(job.getKbId(), caller);
        return toBatchView(job, true);
    }

    @Override
    public List<CompilationBatchView> listByKb(String kbId, int limit, KbCaller caller) {
        if (!hasText(kbId)) {
            throw paramInvalid();
        }
        resourceService.requireReadable(kbId.trim(), caller);
        int size = limit(limit, DEFAULT_BATCH_LIST, MAX_BATCH_LIST);
        List<CompilationBatchView> result = new ArrayList<>();
        QueryWrapper<CompilationJobEntity> query = batchConditions(caller.getTenantCode(),
                kbId.trim()).orderByDesc("create_time").orderByDesc("id")
                .last("LIMIT " + size);
        for (CompilationJobEntity job : jobMapper.selectList(query)) {
            result.add(toBatchView(job, false));
        }
        return result;
    }

    @Override
    public CompilationBatchPageView pageByKb(String kbId, int pageNo, int pageSize,
                                             KbCaller caller) {
        if (!hasText(kbId)) {
            throw paramInvalid();
        }
        resourceService.requireReadable(kbId.trim(), caller);
        int current = pageNo <= 0 ? 1 : pageNo;
        int size = limit(pageSize, DEFAULT_BATCH_LIST, MAX_BATCH_LIST);
        Long total = jobMapper.selectCount(batchConditions(caller.getTenantCode(), kbId.trim()));
        QueryWrapper<CompilationJobEntity> pageQuery = batchConditions(caller.getTenantCode(),
                kbId.trim()).orderByDesc("create_time").orderByDesc("id")
                .last("LIMIT " + size + " OFFSET " + ((long) (current - 1) * size));
        CompilationBatchPageView view = new CompilationBatchPageView();
        view.setPageNo(current);
        view.setPageSize(size);
        view.setTotal(total == null ? 0 : total);
        List<CompilationBatchView> records = new ArrayList<>();
        for (CompilationJobEntity job : jobMapper.selectList(pageQuery)) {
            records.add(toBatchView(job, false));
        }
        view.setRecords(records);
        return view;
    }

    @Override
    public boolean hasRunning(String kbId, KbCaller caller) {
        if (!hasText(kbId)) {
            throw paramInvalid();
        }
        resourceService.requireReadable(kbId.trim(), caller);
        return countRunning(caller.getTenantCode(), kbId.trim()) > 0;
    }

    /** 组别查询条件：同一租户与知识库，排除单文件作业。 */
    private QueryWrapper<CompilationJobEntity> batchConditions(String tenant, String kbId) {
        QueryWrapper<CompilationJobEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("kb_id", kbId).eq("is_deleted", 0)
                .ne("scope_type", BatchScopeType.SINGLE.name());
        return query;
    }

    /** 统计知识库内排队与运行中的组别数量。 */
    private long countRunning(String tenant, String kbId) {
        QueryWrapper<CompilationJobEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("kb_id", kbId).eq("is_deleted", 0)
                .ne("scope_type", BatchScopeType.SINGLE.name())
                .in("run_status", JobRunStatus.QUEUED.name(), JobRunStatus.RUNNING.name());
        Long count = jobMapper.selectCount(query);
        return count == null ? 0 : count;
    }

    /** 按分类或文件夹列出范围内物料，超过成员上限时直接拒绝。 */
    private List<MaterialView> listScopeMaterials(String kbId, String categoryId, KbCaller caller) {
        MaterialQuery query = new MaterialQuery();
        query.setCategoryId(categoryId);
        query.setCurrent(1);
        query.setSize(MAX_BATCH_MEMBERS);
        PageResult<MaterialView> first = materialService.page(kbId, query, caller);
        if (first.getTotal() > MAX_BATCH_MEMBERS) {
            throw paramInvalid();
        }
        List<MaterialView> records = new ArrayList<>(first.getRecords());
        long pages = first.getSize() <= 0 ? 1 : (first.getTotal() + first.getSize() - 1) / first.getSize();
        for (long page = 2; page <= pages; page++) {
            query.setCurrent(page);
            records.addAll(materialService.page(kbId, query, caller).getRecords());
        }
        return records;
    }

    /** 加载组别：单文件作业或缺失记录都按组别不存在处理。 */
    private CompilationJobEntity requireBatch(String tenant, String batchId) {
        if (!hasText(batchId)) {
            throw batchNotFound();
        }
        QueryWrapper<CompilationJobEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("job_id", batchId.trim()).eq("is_deleted", 0)
                .last("LIMIT 1");
        CompilationJobEntity job = jobMapper.selectOne(query);
        if (job == null || BatchScopeType.SINGLE.name().equals(job.getScopeType())) {
            throw batchNotFound();
        }
        return job;
    }

    private CompilationBatchView toBatchView(CompilationJobEntity job, boolean withMembers) {
        List<CompilationJson.ScopeEntry> entries = CompilationJson.entries(job.getInputSnapshot());
        List<CompilationStageEntity> stages = CompilationSupport.roundStages(stageMapper,
                job.getTenantCode(), job.getJobId(), roundOf(job));
        CompilationBatchView view = new CompilationBatchView();
        view.setBatchId(job.getJobId());
        view.setKbId(job.getKbId());
        view.setName(job.getName());
        view.setTaskType(job.getTaskType());
        view.setScopeType(job.getScopeType());
        view.setScopeId(job.getScopeId());
        view.setScopeCount(job.getScopeCount());
        view.setFailureSummary(job.getFailureSummary());
        view.setStartedAt(job.getStartedAt());
        view.setFinishedAt(job.getFinishedAt());
        view.setCreateBy(job.getCreateBy());
        view.setCreateTime(job.getCreateTime());
        if (hasText(job.getCreateBy())) {
            KnowledgeBaseMemberCandidate submitter = principalDirectory.findById(
                    job.getTenantCode(), job.getCreateBy());
            if (submitter != null) {
                view.setSubmitterName(submitter.getName());
            }
        }
        int total = job.getScopeCount() == null ? 0 : job.getScopeCount();
        int success = job.getSuccessCount() == null ? 0 : job.getSuccessCount();
        int failed = job.getFailedCount() == null ? 0 : job.getFailedCount();
        if (JobRunStatus.CANCELED.name().equals(job.getRunStatus()) && total > success) {
            failed = total - success;
        }
        view.setTotalCount(total);
        view.setSuccessCount(success);
        view.setFailedCount(failed);
        view.setStatus(batchStatus(job.getRunStatus(), success));
        if (withMembers) {
            List<CompilationBatchMemberView> members = membersOf(job, entries, stages);
            view.setTotalCount(members.size());
            view.setSuccessCount(countMembers(members, JobRunStatus.COMPLETED.name()));
            view.setFailedCount(countMembers(members, JobRunStatus.FAILED.name())
                    + countMembers(members, JobRunStatus.CANCELED.name()));
            view.setMembers(members);
        }
        return view;
    }

    /** 按冻结清单顺序装配成员，标题与顺序取快照，状态取该文件本轮阶段。 */
    private List<CompilationBatchMemberView> membersOf(CompilationJobEntity job,
                                                       List<CompilationJson.ScopeEntry> entries,
                                                       List<CompilationStageEntity> stages) {
        Map<String, List<CompilationStageEntity>> grouped = CompilationSupport.groupByVersion(stages);
        List<CompilationBatchMemberView> members = new ArrayList<>();
        for (CompilationJson.ScopeEntry entry : entries) {
            List<CompilationStageEntity> rows = grouped.get(entry.getVersionId());
            CompilationBatchMemberView member = new CompilationBatchMemberView();
            member.setJobId(job.getJobId());
            member.setMaterialId(entry.getMaterialId());
            member.setMaterialVersionId(entry.getVersionId());
            member.setMaterialTitle(truncate(entry.getTitle(), 255));
            member.setJobStatus(job.getRunStatus());
            member.setItemStatus(CompilationSupport.memberStatus(rows));
            member.setItemFailureSummary(CompilationSupport.firstFailure(rows));
            member.setMilestone(CompilationSupport.memberMilestone(rows));
            member.setChunkCount(CompilationSupport.memberChunkCount(rows));
            member.setStartedAt(firstStarted(rows));
            member.setFinishedAt(lastFinished(rows));
            members.add(member);
        }
        return members;
    }

    private int countMembers(List<CompilationBatchMemberView> members, String status) {
        int count = 0;
        for (CompilationBatchMemberView member : members) {
            if (status.equals(member.getItemStatus())) {
                count++;
            }
        }
        return count;
    }

    private Instant firstStarted(List<CompilationStageEntity> rows) {
        Instant first = null;
        if (rows == null) {
            return null;
        }
        for (CompilationStageEntity row : rows) {
            if (row.getStartedAt() != null && (first == null || row.getStartedAt().isBefore(first))) {
                first = row.getStartedAt();
            }
        }
        return first;
    }

    private Instant lastFinished(List<CompilationStageEntity> rows) {
        Instant last = null;
        if (rows == null) {
            return null;
        }
        for (CompilationStageEntity row : rows) {
            if (row.getFinishedAt() != null && (last == null || row.getFinishedAt().isAfter(last))) {
                last = row.getFinishedAt();
            }
        }
        return last;
    }

    /** 作业状态映射为组别状态：失败但仍有成功文件时记为部分完成。 */
    private String batchStatus(String runStatus, int successCount) {
        if (JobRunStatus.CANCELED.name().equals(runStatus)) {
            return BatchStatus.CANCELED.name();
        }
        if (JobRunStatus.COMPLETED.name().equals(runStatus)) {
            return BatchStatus.COMPLETED.name();
        }
        if (JobRunStatus.FAILED.name().equals(runStatus)) {
            return successCount > 0 ? BatchStatus.PARTIAL.name() : BatchStatus.FAILED.name();
        }
        return BatchStatus.RUNNING.name();
    }

    private int roundOf(CompilationJobEntity job) {
        return job.getRoundNo() == null ? 1 : job.getRoundNo();
    }
}
