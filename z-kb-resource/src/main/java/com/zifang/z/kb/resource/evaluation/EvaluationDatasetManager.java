package com.zifang.z.***REMOVED***.resource.evaluation;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.***REMOVED***.api.evaluation.BaselineBriefInfo;
import com.zifang.z.***REMOVED***.api.evaluation.DatasetCaseInfo;
import com.zifang.z.***REMOVED***.api.evaluation.DatasetSummaryInfo;
import com.zifang.z.***REMOVED***.api.evaluation.EvalCaseInputParam;
import com.zifang.z.***REMOVED***.api.evaluation.EvalDatasetPublishParam;
import com.zifang.z.***REMOVED***.api.evaluation.EvalDatasetSaveParam;
import com.zifang.z.***REMOVED***.api.evaluation.EvalDatasetStatus;
import com.zifang.z.***REMOVED***.api.evaluation.EvalExpectedBehavior;
import com.zifang.z.***REMOVED***.api.evaluation.EvaluationDatasetInfo;
import com.zifang.z.***REMOVED***.api.evaluation.Evaluation***REMOVED***ItemInfo;
import com.zifang.z.***REMOVED***.api.evaluation.Evaluation***REMOVED***PageInfo;
import com.zifang.z.***REMOVED***.api.evaluation.EvaluationOverviewInfo;
import com.zifang.z.***REMOVED***.api.evaluation.EvaluationStatusCode;
import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseAction;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseQuery;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseView;
import com.zifang.z.***REMOVED***.api.resource.PageResult;
import com.zifang.z.***REMOVED***.storage.evaluation.entity.EvalCaseEntity;
import com.zifang.z.***REMOVED***.storage.evaluation.entity.EvalDatasetEntity;
import com.zifang.z.***REMOVED***.storage.evaluation.entity.EvalResultEntity;
import com.zifang.z.***REMOVED***.storage.evaluation.entity.EvalRunEntity;
import com.zifang.z.***REMOVED***.storage.evaluation.mapper.EvalCaseMapper;
import com.zifang.z.***REMOVED***.storage.evaluation.mapper.EvalDatasetMapper;
import com.zifang.z.***REMOVED***.storage.evaluation.mapper.EvalResultMapper;
import com.zifang.z.***REMOVED***.storage.evaluation.mapper.EvalRunMapper;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.zifang.z.***REMOVED***.resource.evaluation.EvaluationConstants.MAX_CASES;
import static com.zifang.z.***REMOVED***.resource.evaluation.EvaluationConstants.MAX_PAGE_SIZE;
import static com.zifang.z.***REMOVED***.resource.evaluation.EvaluationSupport.defaultText;
import static com.zifang.z.***REMOVED***.resource.evaluation.EvaluationSupport.error;
import static com.zifang.z.***REMOVED***.resource.evaluation.EvaluationSupport.hasText;
import static com.zifang.z.***REMOVED***.resource.evaluation.EvaluationSupport.joinTags;
import static com.zifang.z.***REMOVED***.resource.evaluation.EvaluationSupport.parseBehavior;
import static com.zifang.z.***REMOVED***.resource.evaluation.EvaluationSupport.parseJson;
import static com.zifang.z.***REMOVED***.resource.evaluation.EvaluationSupport.requireText;
import static com.zifang.z.***REMOVED***.resource.evaluation.EvaluationSupport.splitTags;
import static com.zifang.z.***REMOVED***.resource.evaluation.EvaluationSupport.toJson;
import static com.zifang.z.***REMOVED***.resource.evaluation.EvaluationSupport.truncate;

/**
 * QA 数据集：知识库评测列表、概览、版本化草稿与发布。
 */
final class EvaluationDatasetManager {

    private static final String CASE_STATUS_ACTIVE = "ACTIVE";

    private static final String CASE_STATUS_DISABLED = "DISABLED";

    private static final List<String> NOT_CONNECTED_DEFAULT = Collections.unmodifiableList(
            Arrays.asList("S3 语义增强未接入", "S6 融合与精排未接入",
                    "S8 反馈回归未接入", "成本与队列深度未接入"));

    private final KnowledgeBaseResourceService resourceService;

    private final EvalDatasetMapper datasetMapper;

    private final EvalCaseMapper caseMapper;

    private final EvalRunMapper runMapper;

    private final EvalResultMapper resultMapper;

    private final EvaluationQueryAssembler assembler;

    private final EvaluationBadcaseManager badcaseManager;

    EvaluationDatasetManager(KnowledgeBaseResourceService resourceService,
            EvalDatasetMapper datasetMapper,
            EvalCaseMapper caseMapper,
            EvalRunMapper runMapper,
            EvalResultMapper resultMapper,
            EvaluationQueryAssembler assembler,
            EvaluationBadcaseManager badcaseManager) {
        this.resourceService = resourceService;
        this.datasetMapper = datasetMapper;
        this.caseMapper = caseMapper;
        this.runMapper = runMapper;
        this.resultMapper = resultMapper;
        this.assembler = assembler;
        this.badcaseManager = badcaseManager;
    }

    /** 分页查询知识库评测列表，附带数据集版本、最近运行的核心指标通过数及待处理坏例数。 */
    Evaluation***REMOVED***PageInfo pageKnowledgeBase(int current, int size, String keyword, ***REMOVED***Caller caller) {
        String tenantCode = caller.getTenantCode();
        KnowledgeBaseQuery query = new KnowledgeBaseQuery();
        query.setKeyword(keyword);
        query.setCurrent(Math.max(current, 1));
        query.setSize(Math.min(Math.max(size, 1), MAX_PAGE_SIZE));
        PageResult<KnowledgeBaseView> page = resourceService.page(query, caller);
        Evaluation***REMOVED***PageInfo result = new Evaluation***REMOVED***PageInfo();
        result.setTotal(page.getTotal());
        List<Evaluation***REMOVED***ItemInfo> records = new ArrayList<>();
        for (KnowledgeBaseView ***REMOVED*** : page.getRecords()) {
            Evaluation***REMOVED***ItemInfo item = new Evaluation***REMOVED***ItemInfo();
            item.set***REMOVED***Id(***REMOVED***.get***REMOVED***Id());
            item.set***REMOVED***Name(***REMOVED***.getName());
            EvalDatasetEntity dataset = selectLatestFrozen(tenantCode, ***REMOVED***.get***REMOVED***Id());
            if (dataset == null) {
                dataset = selectLatest(tenantCode, ***REMOVED***.get***REMOVED***Id());
            }
            if (dataset != null) {
                item.setDatasetVersion(dataset.getVersionNo());
                item.setDatasetStatus(dataset.getStatus());
                item.setCaseCount(dataset.getCaseCount());
            }
            EvalRunEntity lastRun = selectLatestBy***REMOVED***(tenantCode, ***REMOVED***.get***REMOVED***Id());
            if (lastRun != null) {
                List<EvalResultEntity> rows = assembler.resultsOfRun(tenantCode,
                        lastRun.getRunId());
                item.setLastRunId(lastRun.getRunId());
                item.setLastRunAt(lastRun.getFinishedAt());
                item.setResultUsable(assembler.isUsable(lastRun));
                item.setCoreTotal(6);
                item.setCorePassCount(assembler.countCorePass(rows));
                item.setNotConnected(assembler.notConnectedCodes(rows));
            } else {
                item.setCoreTotal(6);
                item.setNotConnected(new ArrayList<>(NOT_CONNECTED_DEFAULT));
            }
            item.setOpenBadcaseCount(badcaseManager.countOpen(tenantCode, ***REMOVED***.get***REMOVED***Id()));
            records.add(item);
        }
        result.setRecords(records);
        return result;
    }

    /** 汇总知识库评测概览：当前数据集、最近运行摘要、基线运行、坏例统计与可信证据。 */
    EvaluationOverviewInfo queryOverview(String ***REMOVED***Id, String baselineRunId, ***REMOVED***Caller caller) {
        String tenantCode = caller.getTenantCode();
        String key = requireText(***REMOVED***Id, EvaluationStatusCode.EVAL_PARAM_INVALID);
        KnowledgeBaseView ***REMOVED*** = resourceService.requireReadable(key, caller);
        EvaluationOverviewInfo info = new EvaluationOverviewInfo();
        info.set***REMOVED***Id(***REMOVED***.get***REMOVED***Id());
        info.set***REMOVED***Name(***REMOVED***.getName());
        EvalDatasetEntity dataset = selectLatestFrozen(tenantCode, ***REMOVED***.get***REMOVED***Id());
        if (dataset == null) {
            dataset = selectLatest(tenantCode, ***REMOVED***.get***REMOVED***Id());
        }
        if (dataset != null) {
            info.setDataset(toDatasetSummary(dataset));
        }
        EvalRunEntity lastRun = selectLatestBy***REMOVED***(tenantCode, ***REMOVED***.get***REMOVED***Id());
        List<EvalResultEntity> lastRows = new ArrayList<>();
        if (lastRun != null) {
            lastRows = assembler.resultsOfRun(tenantCode, lastRun.getRunId());
            info.setLastRun(assembler.toRunBrief(lastRun, lastRows));
        }
        String baselineId = hasText(baselineRunId) ? baselineRunId.trim()
                : (lastRun == null ? null : lastRun.getBaselineRunId());
        EvalRunEntity baseline = assembler.loadBaseline(tenantCode, ***REMOVED***.get***REMOVED***Id(), baselineId);
        if (baseline != null) {
            BaselineBriefInfo brief = new BaselineBriefInfo();
            brief.setRunId(baseline.getRunId());
            brief.setFinishedAt(baseline.getFinishedAt());
            info.setBaselineRun(brief);
        }
        info.setComparable(assembler.isComparable(lastRun, baseline));
        info.setBadcaseCounts(badcaseManager.countBadcasesInternal(tenantCode, ***REMOVED***.get***REMOVED***Id()));
        if (lastRun != null) {
            info.setEvidence(assembler.buildTrustEvidence(lastRun, lastRows));
            info.setNotConnected(assembler.notConnectedCodes(lastRows));
        } else {
            info.setNotConnected(new ArrayList<>(NOT_CONNECTED_DEFAULT));
        }
        return info;
    }

    /** 查询指定版本的数据集及用例列表，版本号为空时取最新冻结版本，无冻结版本则取最新草稿。 */
    EvaluationDatasetInfo queryDataset(String ***REMOVED***Id, Integer versionNo, ***REMOVED***Caller caller) {
        String tenantCode = caller.getTenantCode();
        String key = requireText(***REMOVED***Id, EvaluationStatusCode.EVAL_PARAM_INVALID);
        KnowledgeBaseView ***REMOVED*** = resourceService.requireReadable(key, caller);
        EvaluationDatasetInfo info = new EvaluationDatasetInfo();
        EvalDatasetEntity dataset;
        if (versionNo != null) {
            dataset = selectByVersion(tenantCode, ***REMOVED***.get***REMOVED***Id(), versionNo);
            if (dataset == null) {
                throw error(EvaluationStatusCode.EVAL_DATASET_NOT_FOUND);
            }
        } else {
            dataset = selectLatestFrozen(tenantCode, ***REMOVED***.get***REMOVED***Id());
            if (dataset == null) {
                dataset = selectLatest(tenantCode, ***REMOVED***.get***REMOVED***Id());
            }
        }
        if (dataset == null) {
            info.setCases(new ArrayList<>());
            return info;
        }
        info.setDataset(toDatasetSummary(dataset));
        List<DatasetCaseInfo> cases = new ArrayList<>();
        for (EvalCaseEntity evalCase : casesOfDataset(tenantCode, dataset.getId())) {
            cases.add(toDatasetCase(evalCase));
        }
        info.setCases(cases);
        return info;
    }

    /** 保存 QA 数据集草稿：新建或覆盖当前草稿版本并重建用例，单次最多 200 条。 */
    @Transactional(rollbackFor = Exception.class)
    DatasetSummaryInfo saveDatasetDraft(EvalDatasetSaveParam param, ***REMOVED***Caller caller) {
        if (param == null) {
            throw error(EvaluationStatusCode.EVAL_PARAM_INVALID);
        }
        String tenantCode = caller.getTenantCode();
        String key = requireText(param.get***REMOVED***Id(), EvaluationStatusCode.EVAL_PARAM_INVALID);
        KnowledgeBaseView ***REMOVED*** = resourceService.requireActionable(key,
                KnowledgeBaseAction.MATERIAL_WRITE, caller);
        List<EvalCaseInputParam> inputs = param.getCases();
        if (inputs == null || inputs.isEmpty()) {
            throw error(EvaluationStatusCode.EVAL_DATASET_EMPTY);
        }
        if (inputs.size() > MAX_CASES) {
            throw error(EvaluationStatusCode.EVAL_DATASET_TOO_MANY);
        }
        List<Integer> caseNos = assignCaseNos(inputs);
        String actorId = caller.getActorId();
        Instant now = Instant.now();
        EvalDatasetEntity dataset = selectDraft(tenantCode, ***REMOVED***.get***REMOVED***Id());
        boolean created = dataset == null;
        if (created) {
            int nextVersion = 1;
            for (EvalDatasetEntity existing : datasetsOf***REMOVED***(tenantCode, ***REMOVED***.get***REMOVED***Id())) {
                if (existing.getVersionNo() != null && existing.getVersionNo() >= nextVersion) {
                    nextVersion = existing.getVersionNo() + 1;
                }
            }
            dataset = new EvalDatasetEntity();
            dataset.setId(UUID.randomUUID().toString());
            dataset.setDatasetId(UUID.randomUUID().toString());
            dataset.setTenantCode(tenantCode);
            dataset.set***REMOVED***Id(***REMOVED***.get***REMOVED***Id());
            dataset.setVersionNo(nextVersion);
            dataset.setStatus(EvalDatasetStatus.DRAFT.name());
            dataset.setIsDeleted(0);
            dataset.setCreateBy(actorId);
            dataset.setCreateTime(now);
        }
        dataset.setName(truncate(defaultText(param.getName(), "QA 集合"), 128));
        dataset.setDescription(truncate(param.getDescription(), 1000));
        dataset.setCaseCount(inputs.size());
        dataset.setUpdateBy(actorId);
        dataset.setUpdateTime(now);
        if (created) {
            datasetMapper.insert(dataset);
        } else {
            datasetMapper.updateById(dataset);
        }

        caseMapper.delete(new QueryWrapper<EvalCaseEntity>()
                .eq("tenant_code", tenantCode)
                .eq("dataset_pk", dataset.getId()));
        Map<String, EvalCaseEntity> inserted = new LinkedHashMap<>();
        for (int i = 0; i < inputs.size(); i++) {
            EvalCaseInputParam input = inputs.get(i);
            String question = requireText(input.getQuestion(),
                    EvaluationStatusCode.EVAL_PARAM_INVALID);
            if (question.length() > 2000) {
                question = question.substring(0, 2000);
            }
            EvalExpectedBehavior behavior = parseBehavior(input.getExpectedBehavior());
            EvalCaseEntity evalCase = new EvalCaseEntity();
            evalCase.setId(UUID.randomUUID().toString());
            evalCase.setCaseId(UUID.randomUUID().toString());
            evalCase.setTenantCode(tenantCode);
            evalCase.setDatasetPk(dataset.getId());
            evalCase.setDatasetId(dataset.getDatasetId());
            evalCase.setDatasetVersionNo(dataset.getVersionNo());
            evalCase.setCaseNo(caseNos.get(i));
            evalCase.setQuestion(question);
            evalCase.setExpectedAnswer(input.getExpectedAnswer());
            evalCase.setExpectedBehavior(behavior.name());
            evalCase.setExpectedEvidence(toJson(input.getExpectedEvidence()));
            evalCase.setEntryType(truncate(defaultText(input.getEntryType(), "DOCUMENT"), 32));
            evalCase.setTags(joinTags(input.getTags()));
            evalCase.setStatus(CASE_STATUS_ACTIVE);
            evalCase.setIsDeleted(0);
            evalCase.setCreateBy(actorId);
            evalCase.setUpdateBy(actorId);
            evalCase.setCreateTime(now);
            evalCase.setUpdateTime(now);
            caseMapper.insert(evalCase);
            inserted.put(evalCase.getId(), evalCase);
        }
        dataset.setCaseCount(inserted.size());
        datasetMapper.updateById(dataset);
        return toDatasetSummary(dataset);
    }

    /** 将草稿数据集发布为冻结版本，校验版本号一致且至少存在一条有效用例。 */
    @Transactional(rollbackFor = Exception.class)
    DatasetSummaryInfo publishDataset(EvalDatasetPublishParam param, ***REMOVED***Caller caller) {
        if (param == null) {
            throw error(EvaluationStatusCode.EVAL_PARAM_INVALID);
        }
        String tenantCode = caller.getTenantCode();
        String key = requireText(param.get***REMOVED***Id(), EvaluationStatusCode.EVAL_PARAM_INVALID);
        KnowledgeBaseView ***REMOVED*** = resourceService.requireActionable(key,
                KnowledgeBaseAction.MATERIAL_WRITE, caller);
        EvalDatasetEntity dataset;
        if (param.getExpectedVersionNo() != null) {
            dataset = selectByVersion(tenantCode, ***REMOVED***.get***REMOVED***Id(), param.getExpectedVersionNo());
            if (dataset == null) {
                throw error(EvaluationStatusCode.EVAL_DATASET_NOT_FOUND);
            }
        } else {
            dataset = selectDraft(tenantCode, ***REMOVED***.get***REMOVED***Id());
            if (dataset == null) {
                throw error(EvaluationStatusCode.EVAL_DATASET_NOT_FOUND);
            }
        }
        if (!EvalDatasetStatus.DRAFT.name().equals(dataset.getStatus())) {
            throw error(EvaluationStatusCode.EVAL_DATASET_STATUS_INVALID);
        }
        if (param.getExpectedVersionNo() != null
                && !param.getExpectedVersionNo().equals(dataset.getVersionNo())) {
            throw error(EvaluationStatusCode.EVAL_DATASET_VERSION_MISMATCH);
        }
        List<EvalCaseEntity> cases = activeCases(tenantCode, dataset.getId());
        if (cases.isEmpty()) {
            throw error(EvaluationStatusCode.EVAL_DATASET_EMPTY);
        }
        dataset.setStatus(EvalDatasetStatus.FROZEN.name());
        dataset.setCaseCount(cases.size());
        dataset.setPublishedBy(caller.getActorId());
        dataset.setPublishedAt(Instant.now());
        dataset.setUpdateBy(caller.getActorId());
        dataset.setUpdateTime(Instant.now());
        datasetMapper.updateById(dataset);
        return toDatasetSummary(dataset);
    }

    /** 列出数据集下未禁用的用例。 */
    List<EvalCaseEntity> activeCases(String tenantCode, String datasetPk) {
        List<EvalCaseEntity> cases = new ArrayList<>();
        for (EvalCaseEntity evalCase : casesOfDataset(tenantCode, datasetPk)) {
            if (!CASE_STATUS_DISABLED.equals(evalCase.getStatus())) {
                cases.add(evalCase);
            }
        }
        return cases;
    }

    /** 按库查询数据集版本，按版本号倒序。 */
    List<EvalDatasetEntity> datasetsOf***REMOVED***(String tenantCode, String ***REMOVED***Id) {
        return datasetMapper.selectList(new QueryWrapper<EvalDatasetEntity>()
                .eq("tenant_code", tenantCode)
                .eq("***REMOVED***_id", ***REMOVED***Id)
                .eq("is_deleted", 0)
                .orderByDesc("version_no"));
    }

    /** 按版本号查询数据集。 */
    EvalDatasetEntity selectByVersion(String tenantCode, String ***REMOVED***Id, Integer versionNo) {
        return datasetMapper.selectOne(new QueryWrapper<EvalDatasetEntity>()
                .eq("tenant_code", tenantCode)
                .eq("***REMOVED***_id", ***REMOVED***Id)
                .eq("version_no", versionNo)
                .eq("is_deleted", 0));
    }

    /** 查询知识库最新数据集版本。 */
    EvalDatasetEntity selectLatest(String tenantCode, String ***REMOVED***Id) {
        return datasetMapper.selectOne(new QueryWrapper<EvalDatasetEntity>()
                .eq("tenant_code", tenantCode)
                .eq("***REMOVED***_id", ***REMOVED***Id)
                .eq("is_deleted", 0)
                .orderByDesc("version_no")
                .last("LIMIT 1"));
    }

    /** 查询知识库最新冻结数据集版本。 */
    EvalDatasetEntity selectLatestFrozen(String tenantCode, String ***REMOVED***Id) {
        return datasetMapper.selectOne(new QueryWrapper<EvalDatasetEntity>()
                .eq("tenant_code", tenantCode)
                .eq("***REMOVED***_id", ***REMOVED***Id)
                .eq("status", EvalDatasetStatus.FROZEN.name())
                .eq("is_deleted", 0)
                .orderByDesc("version_no")
                .last("LIMIT 1"));
    }

    /** 查询知识库当前草稿数据集版本。 */
    EvalDatasetEntity selectDraft(String tenantCode, String ***REMOVED***Id) {
        return datasetMapper.selectOne(new QueryWrapper<EvalDatasetEntity>()
                .eq("tenant_code", tenantCode)
                .eq("***REMOVED***_id", ***REMOVED***Id)
                .eq("status", EvalDatasetStatus.DRAFT.name())
                .eq("is_deleted", 0)
                .orderByDesc("version_no")
                .last("LIMIT 1"));
    }

    /** 按数据集主键查询用例，按用例编号升序。 */
    private List<EvalCaseEntity> casesOfDataset(String tenantCode, String datasetPk) {
        return caseMapper.selectList(new QueryWrapper<EvalCaseEntity>()
                .eq("tenant_code", tenantCode)
                .eq("dataset_pk", datasetPk)
                .eq("is_deleted", 0)
                .orderByAsc("case_no"));
    }

    /** 查询知识库最近一次运行。 */
    private EvalRunEntity selectLatestBy***REMOVED***(String tenantCode, String ***REMOVED***Id) {
        return runMapper.selectOne(new QueryWrapper<EvalRunEntity>()
                .eq("tenant_code", tenantCode)
                .eq("***REMOVED***_id", ***REMOVED***Id)
                .eq("is_deleted", 0)
                .orderByDesc("create_time")
                .orderByDesc("id")
                .last("LIMIT 1"));
    }

    /** 将数据集实体转为摘要信息。 */
    private DatasetSummaryInfo toDatasetSummary(EvalDatasetEntity dataset) {
        DatasetSummaryInfo info = new DatasetSummaryInfo();
        info.setDatasetId(dataset.getDatasetId());
        info.set***REMOVED***Id(dataset.get***REMOVED***Id());
        info.setName(dataset.getName());
        info.setVersionNo(dataset.getVersionNo());
        info.setStatus(dataset.getStatus());
        info.setCaseCount(dataset.getCaseCount());
        info.setDescription(dataset.getDescription());
        info.setPublishedAt(dataset.getPublishedAt());
        return info;
    }

    /** 将用例实体转为数据集详情中的用例信息，反序列化期望证据并拆分标签。 */
    private DatasetCaseInfo toDatasetCase(EvalCaseEntity evalCase) {
        DatasetCaseInfo info = new DatasetCaseInfo();
        info.setCaseId(evalCase.getCaseId());
        info.setCaseNo(evalCase.getCaseNo());
        info.setQuestion(evalCase.getQuestion());
        info.setExpectedAnswer(evalCase.getExpectedAnswer());
        info.setExpectedBehavior(evalCase.getExpectedBehavior());
        info.setExpectedEvidence(parseJson(evalCase.getExpectedEvidence()));
        info.setTags(splitTags(evalCase.getTags()));
        return info;
    }

    /** 为用例分配编号：显式编号须为正且不重复，缺省编号从 1 起填补空缺。 */
    private List<Integer> assignCaseNos(List<EvalCaseInputParam> inputs) {
        Set<Integer> used = new LinkedHashSet<>();
        List<Integer> assigned = new ArrayList<>();
        for (EvalCaseInputParam input : inputs) {
            if (input.getCaseNo() != null) {
                if (input.getCaseNo() <= 0 || !used.add(input.getCaseNo())) {
                    throw error(EvaluationStatusCode.EVAL_PARAM_INVALID);
                }
            }
        }
        int next = 1;
        for (EvalCaseInputParam input : inputs) {
            if (input.getCaseNo() != null) {
                assigned.add(input.getCaseNo());
            } else {
                while (used.contains(next)) {
                    next++;
                }
                used.add(next);
                assigned.add(next);
                next++;
            }
        }
        return assigned;
    }
}
