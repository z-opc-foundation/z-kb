package com.zifang.z.***REMOVED***.api.evaluation;

import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;

/**
 * 知识评测。QA 集合版本化、同步本地确定性跑批、四层指标、坏例台账与基线对比。
 */
public interface EvaluationService {

    /** 分页查询参与评测的知识库列表，支持按名称关键字过滤。 */
    Evaluation***REMOVED***PageInfo pageKnowledgeBase(int current, int size, String keyword, ***REMOVED***Caller caller);

    /** 汇总知识库评测概览：数据集版本、最新运行指标及相对基线的变化。 */
    EvaluationOverviewInfo queryOverview(String ***REMOVED***Id, String baselineRunId, ***REMOVED***Caller caller);

    /** 查询指定知识库的数据集详情，版本号为空时返回当前生效版本。 */
    EvaluationDatasetInfo queryDataset(String ***REMOVED***Id, Integer versionNo, ***REMOVED***Caller caller);

    /** 保存 QA 数据集草稿，生成或更新未发布的草稿版本。 */
    DatasetSummaryInfo saveDatasetDraft(EvalDatasetSaveParam param, ***REMOVED***Caller caller);

    /** 发布数据集草稿，冻结版本并将其设为评测可用版本。 */
    DatasetSummaryInfo publishDataset(EvalDatasetPublishParam param, ***REMOVED***Caller caller);

    /** 基于指定数据集版本创建一次评测运行，返回运行摘要。 */
    RunSummaryInfo createRun(EvalRunCreateParam param, ***REMOVED***Caller caller);

    /** 查询单个评测运行的详情，含分层指标、阶段状态与基线对比。 */
    EvalRunQueryInfo queryRun(String runId, ***REMOVED***Caller caller);

    /** 分页查询运行下的用例结果，可按阶段或状态筛选。 */
    EvalCaseResultPageInfo pageCaseResults(EvalCaseResultPageParam param, ***REMOVED***Caller caller);

    /** 列出知识库的坏例台账，可按处理状态与失败阶段过滤。 */
    EvalBadcaseListInfo listBadcases(String ***REMOVED***Id, String status, String stageCode,
            ***REMOVED***Caller caller);

    /** 统计知识库坏例数量，按处理状态和阶段分类汇总。 */
    BadcaseCountInfo countBadcases(String ***REMOVED***Id, ***REMOVED***Caller caller);

    /** 查询运行的可信证据明细，用于解释指标取值的来源。 */
    java.util.List<TrustEvidenceInfo> queryTrustEvidence(String runId, ***REMOVED***Caller caller);

    /** 更新坏例的处理状态与备注，返回更新后的坏例信息。 */
    EvalBadcaseInfo updateBadcase(EvalBadcaseUpdateParam param, ***REMOVED***Caller caller);
}
