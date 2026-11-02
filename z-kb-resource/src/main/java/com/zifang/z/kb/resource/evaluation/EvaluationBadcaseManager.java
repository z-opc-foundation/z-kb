package com.zifang.z.kb.resource.evaluation;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.evaluation.BadcaseCountInfo;
import com.zifang.z.kb.api.evaluation.EvalBadcaseInfo;
import com.zifang.z.kb.api.evaluation.EvalBadcaseListInfo;
import com.zifang.z.kb.api.evaluation.EvalBadcaseStatus;
import com.zifang.z.kb.api.evaluation.EvalBadcaseUpdateParam;
import com.zifang.z.kb.api.evaluation.EvalScopeType;
import com.zifang.z.kb.api.evaluation.EvaluationStage;
import com.zifang.z.kb.api.evaluation.EvaluationStatusCode;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBaseAction;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.resource.KnowledgeBaseView;
import com.zifang.z.kb.storage.evaluation.entity.EvalBadcaseEntity;
import com.zifang.z.kb.storage.evaluation.entity.EvalCaseEntity;
import com.zifang.z.kb.storage.evaluation.entity.EvalRunEntity;
import com.zifang.z.kb.storage.evaluation.mapper.EvalBadcaseMapper;
import com.zifang.z.kb.storage.evaluation.mapper.EvalCaseMapper;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.error;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.failingStages;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.hasText;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.parseBadcaseStatus;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.requireText;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.truncate;

/**
 * 坏例台账：按失败阶段登记、累加与回归，维护处理状态、负责人与备注。
 */
final class EvaluationBadcaseManager {

    private final KnowledgeBaseResourceService resourceService;

    private final EvalBadcaseMapper badcaseMapper;

    private final EvalCaseMapper caseMapper;

    EvaluationBadcaseManager(KnowledgeBaseResourceService resourceService,
            EvalBadcaseMapper badcaseMapper, EvalCaseMapper caseMapper) {
        this.resourceService = resourceService;
        this.badcaseMapper = badcaseMapper;
        this.caseMapper = caseMapper;
    }

    /** 列出知识库坏例台账，支持按处理状态与失败阶段过滤，传 ALL 表示不限制状态。 */
    EvalBadcaseListInfo listBadcases(String kbId, String status, String stageCode, KbCaller caller) {
        String tenantCode = caller.getTenantCode();
        String key = requireText(kbId, EvaluationStatusCode.EVAL_PARAM_INVALID);
        KnowledgeBaseView kb = resourceService.requireReadable(key, caller);
        String statusFilter = null;
        if (hasText(status) && !"ALL".equalsIgnoreCase(status.trim())) {
            statusFilter = parseBadcaseStatus(status).name();
        }
        String stageFilter = null;
        if (hasText(stageCode)) {
            EvaluationStage stage = EvaluationStage.of(stageCode);
            if (stage == null || !stage.isRunnable()) {
                throw error(EvaluationStatusCode.EVAL_STAGE_INVALID);
            }
            stageFilter = stage.name();
        }
        QueryWrapper<EvalBadcaseEntity> query = new QueryWrapper<EvalBadcaseEntity>()
                .eq("tenant_code", tenantCode)
                .eq("kb_id", kb.getKbId())
                .eq("is_deleted", 0)
                .orderByDesc("id");
        if (statusFilter != null) {
            query.eq("status", statusFilter);
        }
        if (stageFilter != null) {
            query.eq("stage_code", stageFilter);
        }
        List<EvalBadcaseInfo> records = new ArrayList<>();
        for (EvalBadcaseEntity row : badcaseMapper.selectList(query)) {
            records.add(toBadcaseInfo(tenantCode, row));
        }
        EvalBadcaseListInfo info = new EvalBadcaseListInfo();
        info.setRecords(records);
        info.setTotal(records.size());
        return info;
    }

    /** 统计知识库坏例的待处理、已修复与回归数量。 */
    BadcaseCountInfo countBadcases(String kbId, KbCaller caller) {
        String key = requireText(kbId, EvaluationStatusCode.EVAL_PARAM_INVALID);
        KnowledgeBaseView kb = resourceService.requireReadable(key, caller);
        return countBadcasesInternal(caller.getTenantCode(), kb.getKbId());
    }

    /** 更新坏例状态、负责人与备注；标记为已修复时记录最后一次出现的运行。 */
    @Transactional(rollbackFor = Exception.class)
    EvalBadcaseInfo updateBadcase(EvalBadcaseUpdateParam param, KbCaller caller) {
        if (param == null || !hasText(param.getBadcaseId())) {
            throw error(EvaluationStatusCode.EVAL_PARAM_INVALID);
        }
        String tenantCode = caller.getTenantCode();
        EvalBadcaseEntity badcase = badcaseMapper.selectOne(new QueryWrapper<EvalBadcaseEntity>()
                .eq("tenant_code", tenantCode)
                .eq("id", param.getBadcaseId().trim())
                .eq("is_deleted", 0));
        if (badcase == null) {
            throw error(EvaluationStatusCode.EVAL_BADCASE_NOT_FOUND);
        }
        resourceService.requireActionable(badcase.getKbId(), KnowledgeBaseAction.MATERIAL_REVIEW,
                caller);
        if (hasText(param.getStatus())) {
            EvalBadcaseStatus status = parseBadcaseStatus(param.getStatus());
            badcase.setStatus(status.name());
            if (EvalBadcaseStatus.FIXED == status) {
                badcase.setResolvedRunId(badcase.getLastSeenRunId());
            }
        }
        if (param.getOwner() != null) {
            badcase.setOwner(truncate(param.getOwner(), 64));
        }
        if (param.getNote() != null) {
            badcase.setNote(truncate(param.getNote(), 1000));
        }
        badcase.setUpdateBy(caller.getActorId());
        badcase.setUpdateTime(Instant.now());
        badcaseMapper.updateById(badcase);
        return toBadcaseInfo(tenantCode, badcase);
    }

    /** 按失败阶段登记或更新坏例：首次出现新建，重复出现累加次数，已修复的转为回归。 */
    void upsertBadcases(String tenantCode, EvalRunEntity run, CaseOutcome outcome,
            EvalScopeType scope, EvaluationStage stage, String actorId) {
        List<String> failing = failingStages(outcome.stageTrace);
        for (String stageCode : failing) {
            if (scope == EvalScopeType.STAGE && (stage == null || !stage.name().equals(stageCode))) {
                continue;
            }
            EvalBadcaseEntity badcase = badcaseMapper.selectOne(
                    new QueryWrapper<EvalBadcaseEntity>()
                            .eq("tenant_code", tenantCode)
                            .eq("kb_id", run.getKbId())
                            .eq("case_id", outcome.evalCase.getCaseId())
                            .eq("stage_code", stageCode)
                            .eq("is_deleted", 0));
            Instant now = Instant.now();
            if (badcase == null) {
                badcase = new EvalBadcaseEntity();
                badcase.setId(UUID.randomUUID().toString());
                badcase.setTenantCode(tenantCode);
                badcase.setKbId(run.getKbId());
                badcase.setCaseId(outcome.evalCase.getCaseId());
                badcase.setStageCode(stageCode);
                badcase.setCategory(stageCategory(stageCode));
                badcase.setSeverity(stageSeverity(stageCode));
                badcase.setStatus(EvalBadcaseStatus.OPEN.name());
                badcase.setFirstSeenRunId(run.getRunId());
                badcase.setLastSeenRunId(run.getRunId());
                badcase.setOccurrenceCount(1);
                badcase.setIsDeleted(0);
                badcase.setCreateBy(actorId);
                badcase.setUpdateBy(actorId);
                badcase.setCreateTime(now);
                badcase.setUpdateTime(now);
                badcaseMapper.insert(badcase);
            } else {
                badcase.setLastSeenRunId(run.getRunId());
                badcase.setOccurrenceCount((badcase.getOccurrenceCount() == null
                        ? 0 : badcase.getOccurrenceCount()) + 1);
                if (EvalBadcaseStatus.FIXED.name().equals(badcase.getStatus())) {
                    badcase.setStatus(EvalBadcaseStatus.REGRESSED.name());
                }
                badcase.setUpdateBy(actorId);
                badcase.setUpdateTime(now);
                badcaseMapper.updateById(badcase);
            }
        }
    }

    /** 统计知识库坏例在待处理、已修复、已回归三种状态下的数量。 */
    BadcaseCountInfo countBadcasesInternal(String tenantCode, String kbId) {
        BadcaseCountInfo info = new BadcaseCountInfo();
        long open = 0L;
        long fixed = 0L;
        long regressed = 0L;
        for (EvalBadcaseEntity row : badcaseMapper.selectList(new QueryWrapper<EvalBadcaseEntity>()
                .eq("tenant_code", tenantCode)
                .eq("kb_id", kbId)
                .eq("is_deleted", 0))) {
            if (EvalBadcaseStatus.FIXED.name().equals(row.getStatus())) {
                fixed++;
            } else if (EvalBadcaseStatus.REGRESSED.name().equals(row.getStatus())) {
                regressed++;
            } else if (EvalBadcaseStatus.OPEN.name().equals(row.getStatus())) {
                open++;
            }
        }
        info.setOpen(open);
        info.setFixed(fixed);
        info.setRegressed(regressed);
        return info;
    }

    /** 统计知识库下待处理的坏例数量。 */
    long countOpen(String tenantCode, String kbId) {
        Long count = badcaseMapper.selectCount(new QueryWrapper<EvalBadcaseEntity>()
                .eq("tenant_code", tenantCode)
                .eq("kb_id", kbId)
                .eq("status", EvalBadcaseStatus.OPEN.name())
                .eq("is_deleted", 0));
        return count == null ? 0L : count;
    }

    /** 将坏例实体转为展示信息，并回查对应用例的问题文本。 */
    private EvalBadcaseInfo toBadcaseInfo(String tenantCode, EvalBadcaseEntity badcase) {
        EvalBadcaseInfo info = new EvalBadcaseInfo();
        info.setBadcaseId(badcase.getId());
        info.setCaseId(badcase.getCaseId());
        EvalCaseEntity evalCase = caseMapper.selectOne(new QueryWrapper<EvalCaseEntity>()
                .eq("tenant_code", tenantCode)
                .eq("case_id", badcase.getCaseId())
                .eq("is_deleted", 0));
        info.setQuestion(evalCase == null ? "" : evalCase.getQuestion());
        info.setStageCode(badcase.getStageCode());
        info.setCategory(badcase.getCategory());
        info.setSeverity(badcase.getSeverity());
        info.setStatus(badcase.getStatus());
        info.setOwner(badcase.getOwner());
        info.setNote(badcase.getNote());
        info.setOccurrenceCount(badcase.getOccurrenceCount());
        info.setLastSeenRunId(badcase.getLastSeenRunId());
        return info;
    }

    /** 由阶段编码生成坏例分类名，未知阶段统一归为“阶段失败”。 */
    private String stageCategory(String stageCode) {
        EvaluationStage stage = EvaluationStage.of(stageCode);
        return stage == null ? "阶段失败" : stage.getLabel() + "失败";
    }

    /** 按阶段给出坏例严重级别：S1/S4/S5/S7 为高，S2/S3/S6 为中，其余为低。 */
    private String stageSeverity(String stageCode) {
        if (EvaluationStage.S1.name().equals(stageCode)
                || EvaluationStage.S4.name().equals(stageCode)
                || EvaluationStage.S5.name().equals(stageCode)
                || EvaluationStage.S7.name().equals(stageCode)) {
            return "HIGH";
        }
        if (EvaluationStage.S2.name().equals(stageCode)
                || EvaluationStage.S3.name().equals(stageCode)
                || EvaluationStage.S6.name().equals(stageCode)) {
            return "MEDIUM";
        }
        return "LOW";
    }
}
