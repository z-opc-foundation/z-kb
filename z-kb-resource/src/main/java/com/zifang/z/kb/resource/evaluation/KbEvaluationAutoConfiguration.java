package com.zifang.z.***REMOVED***.resource.evaluation;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zifang.z.***REMOVED***.api.evaluation.EvaluationService;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.***REMOVED***.core.retrieval.LocalHashEmbedding;
import com.zifang.z.***REMOVED***.storage.compilation.mapper.ArtifactMapper;
import com.zifang.z.***REMOVED***.storage.compilation.mapper.ArtifactVersionMapper;
import com.zifang.z.***REMOVED***.storage.compilation.mapper.CompilationJobMapper;
import com.zifang.z.***REMOVED***.storage.compilation.mapper.RetrievalChunkMapper;
import com.zifang.z.***REMOVED***.storage.evaluation.mapper.EvalBadcaseMapper;
import com.zifang.z.***REMOVED***.storage.evaluation.mapper.EvalCaseMapper;
import com.zifang.z.***REMOVED***.storage.evaluation.mapper.EvalCaseResultMapper;
import com.zifang.z.***REMOVED***.storage.evaluation.mapper.EvalDatasetMapper;
import com.zifang.z.***REMOVED***.storage.evaluation.mapper.EvalResultMapper;
import com.zifang.z.***REMOVED***.storage.evaluation.mapper.EvalRunMapper;
import com.zifang.z.***REMOVED***.storage.evaluation.mapper.***REMOVED***SnapshotItemMapper;
import com.zifang.z.***REMOVED***.storage.evaluation.mapper.***REMOVED***SnapshotMapper;
import com.zifang.z.***REMOVED***.storage.material.mapper.MaterialMapper;
import com.zifang.z.***REMOVED***.storage.material.mapper.MaterialVersionMapper;
import com.zifang.z.***REMOVED***.storage.resource.mapper.KnowledgeBaseProfileMapper;
import com.zifang.z.***REMOVED***.storage.taskconfig.mapper.TaskConfigMapper;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;

import javax.sql.DataSource;

/**
 * 评测域装配：快照构建、本地规则打分、指标计算、查询装配与同步跑批。
 *
 * <p>与 {@link com.zifang.z.***REMOVED***.resource.***REMOVED***ResourceAutoConfiguration} 同口径（DataSource + 开关），
 * 依赖其提供的 {@link KnowledgeBaseResourceService}，因此在它之后装配。</p>
 */
@AutoConfiguration(after = com.zifang.z.***REMOVED***.resource.***REMOVED***ResourceAutoConfiguration.class)
@ConditionalOnClass({DataSource.class, BaseMapper.class})
@ConditionalOnBean(DataSource.class)
@ConditionalOnProperty(name = "z***REMOVED***.resource.persistence.enabled", havingValue = "true",
        matchIfMissing = true)
public class ***REMOVED***EvaluationAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public EvaluationService evaluationService(KnowledgeBaseResourceService resourceService,
                                               MaterialMapper materialMapper,
                                               MaterialVersionMapper materialVersionMapper,
                                               ArtifactMapper artifactMapper,
                                               ArtifactVersionMapper artifactVersionMapper,
                                               RetrievalChunkMapper retrievalChunkMapper,
                                               ***REMOVED***SnapshotMapper ***REMOVED***SnapshotMapper,
                                               ***REMOVED***SnapshotItemMapper ***REMOVED***SnapshotItemMapper,
                                               EvalBadcaseMapper evalBadcaseMapper,
                                               EvalCaseMapper evalCaseMapper,
                                               EvalCaseResultMapper evalCaseResultMapper,
                                               EvalDatasetMapper evalDatasetMapper,
                                               EvalRunMapper evalRunMapper,
                                               EvalResultMapper evalResultMapper,
                                               KnowledgeBaseProfileMapper profileMapper,
                                               TaskConfigMapper taskConfigMapper,
                                               CompilationJobMapper compilationJobMapper) {
        LocalHashEmbedding embedding = new LocalHashEmbedding();
        EvaluationSnapshotBuilder snapshotBuilder = new EvaluationSnapshotBuilder(materialMapper,
                materialVersionMapper, artifactMapper, artifactVersionMapper, retrievalChunkMapper,
                ***REMOVED***SnapshotMapper, ***REMOVED***SnapshotItemMapper, embedding);
        EvaluationBadcaseManager badcaseManager = new EvaluationBadcaseManager(resourceService,
                evalBadcaseMapper, evalCaseMapper);
        EvaluationCaseScorer caseScorer = new EvaluationCaseScorer(embedding);
        EvaluationMetricCalculator metricCalculator = new EvaluationMetricCalculator(embedding,
                evalResultMapper);
        EvaluationQueryAssembler queryAssembler = new EvaluationQueryAssembler(resourceService,
                evalRunMapper, evalResultMapper, evalCaseResultMapper, evalCaseMapper,
                ***REMOVED***SnapshotMapper, badcaseManager);
        EvaluationDatasetManager datasetManager = new EvaluationDatasetManager(resourceService,
                evalDatasetMapper, evalCaseMapper, evalRunMapper, evalResultMapper, queryAssembler,
                badcaseManager);
        EvaluationRunExecutor runExecutor = new EvaluationRunExecutor(resourceService,
                profileMapper, compilationJobMapper, taskConfigMapper, evalCaseResultMapper,
                evalRunMapper, embedding, snapshotBuilder, caseScorer, metricCalculator,
                badcaseManager, datasetManager, queryAssembler);
        return new DefaultEvaluationService(badcaseManager, datasetManager, queryAssembler,
                runExecutor);
    }
}
