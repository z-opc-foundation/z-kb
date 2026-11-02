package com.zifang.z.kb.resource.retrieval;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.compilation.CompilationJobView;
import com.zifang.z.kb.api.compilation.CompilationService;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.material.MaterialUploadFile;
import com.zifang.z.kb.api.material.MaterialUploadItem;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBase;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.resource.KnowledgeBaseType;
import com.zifang.z.kb.api.resource.KnowledgeBaseView;
import com.zifang.z.kb.api.retrieval.KnowledgeRetrievalService;
import com.zifang.z.kb.api.retrieval.RetrievalHitView;
import com.zifang.z.kb.api.retrieval.RetrievalQueryParam;
import com.zifang.z.kb.api.retrieval.RetrievalResultView;
import com.zifang.z.kb.resource.KbResourceTestApplication;
import com.zifang.z.kb.storage.compilation.entity.RetrievalChunkEntity;
import com.zifang.z.kb.storage.compilation.mapper.RetrievalChunkMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 检索域集成测试：真起 Spring 容器 + H2，钉住 dense 召回、解释字段与参数边界。
 */
@SpringBootTest(classes = KbResourceTestApplication.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:kb-retrieval;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "kb.storage.path=target/test-kb/retrieval-kb.json",
        "kb.material.storage.root=target/test-kb/retrieval-original",
        "kb.material.repo.root=target/test-kb/retrieval-repo",
        "spring.main.banner-mode=off"
})
class KnowledgeRetrievalServiceIntegrationTest {

    private static final String TENANT = "t-retrieval";
    private static final String ACTOR = "u-retrieval-owner";

    @Autowired
    private KnowledgeBaseResourceService resourceService;

    @Autowired
    private MaterialService materialService;

    @Autowired
    private CompilationService compilationService;

    @Autowired
    private KnowledgeRetrievalService retrievalService;

    @Autowired
    private RetrievalChunkMapper chunkMapper;

    @Test
    @DisplayName("融合召回：命中带分数、命中词与章节上下文，缺失向量按需回填")
    void retrieveExplainsHitsAndBackfillsEmbeddings() {
        KbCaller caller = KbCaller.of(TENANT, ACTOR);
        KnowledgeBaseView kb = createKb(caller);
        String content = "# 运维手册\n\nInfluxDB 负责存储监控指标，Prometheus 负责采集。\n\n"
                + "## 告警\n\n告警规则由 Prometheus 评估后写入 Alertmanager。" + "指标采集说明。".repeat(120);
        String materialId = registerText(kb.getKbId(), "运维手册", content, caller);
        CompilationJobView job = compilationService.run(materialId, null, caller);
        assertEquals("COMPLETED", job.getRunStatus());

        RetrievalResultView result = retrievalService.retrieve(query(kb.getKbId(), "Prometheus 告警"), caller);
        // 缺省模式落到 fusion（向量 + BM25 + 图谱三路 RRF 融合），不再是单路 dense。
        assertEquals("fusion", result.getMode());
        assertEquals("local-hash-ngram-v1", result.getEmbeddingModel());
        assertEquals(10, result.getTopK());
        // 默认 minScore 归零：RRF 融合分的量级与余弦分不同（RRF ≈ w/(k+rank) ≈ 0.008 量级），
        // 沿用旧 dense 口径的 0.1 会把命中全滤掉 —— 阈值交给调用方按需显式传。
        assertEquals(0.0d, result.getMinScore(), 1.0e-9);
        assertFalse(result.getHits().isEmpty());
        assertEquals(result.getHits().size(), result.getReturned());
        assertTrue(result.getTotalCandidates() > 0);
        assertFalse(result.isTruncated());

        RetrievalHitView top = result.getHits().get(0);
        assertEquals(1, top.getRank());
        assertNotNull(top.getChunkId());
        assertEquals(materialId, top.getMaterialId());
        assertEquals("运维手册", top.getMaterialTitle());
        assertEquals("INDEXED", top.getIndexState());
        assertTrue(top.getScore() > 0.0d);
        assertFalse(top.getMatchedTerms().isEmpty());
        assertTrue(top.getExplanation().startsWith("RRF 融合分 "),
                "解释应以 RRF 融合分开头，实际=" + top.getExplanation());
        assertTrue(top.getExplanation().contains("命中词「"),
                "解释应含命中词，实际=" + top.getExplanation());
        RetrievalHitView withSection = result.getHits().stream()
                .filter(hit -> hit.getParentChunkId() != null)
                .findFirst().orElse(null);
        assertNotNull(withSection, "长章节应产出回指 SECTION 的段落块");
        assertFalse(withSection.getSectionContent() == null || withSection.getSectionContent().isEmpty());

        QueryWrapper<RetrievalChunkEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", TENANT).eq("chunk_id", top.getChunkId());
        RetrievalChunkEntity stored = chunkMapper.selectOne(query);
        assertNotNull(stored);
        assertEquals("local-hash-ngram-v1", stored.getEmbeddingModel());
        assertNotNull(stored.getEmbedding());
    }

    @Test
    @DisplayName("参数与状态边界：topK / minScore / 查询长度 / 模式 / 租户隔离")
    void guardsParametersAndTenantBoundary() {
        KbCaller caller = KbCaller.of(TENANT, ACTOR);
        KnowledgeBaseView kb = createKb(caller);
        String materialId = registerText(kb.getKbId(), "边界验证",
                "# 边界\n\nRedis 缓存与 Kafka 消息队列。" + "边界说明。".repeat(40), caller);
        compilationService.run(materialId, null, caller);

        KBException blank = assertThrows(KBException.class, () -> {
            RetrievalQueryParam param = new RetrievalQueryParam();
            param.setKbId(kb.getKbId());
            retrievalService.retrieve(param, caller);
        });
        assertEquals("KB_RETRIEVAL_PARAM_INVALID", blank.getCode());

        KBException longQuery = assertThrows(KBException.class, () -> {
            RetrievalQueryParam param = query(kb.getKbId(), "长".repeat(201));
            retrievalService.retrieve(param, caller);
        });
        assertEquals("KB_RETRIEVAL_PARAM_INVALID", longQuery.getCode());

        KBException topK = assertThrows(KBException.class, () -> {
            RetrievalQueryParam param = query(kb.getKbId(), "Redis");
            param.setTopK(51);
            retrievalService.retrieve(param, caller);
        });
        assertEquals("KB_RETRIEVAL_PARAM_INVALID", topK.getCode());

        KBException minScore = assertThrows(KBException.class, () -> {
            RetrievalQueryParam param = query(kb.getKbId(), "Redis");
            param.setMinScore(1.5d);
            retrievalService.retrieve(param, caller);
        });
        assertEquals("KB_RETRIEVAL_PARAM_INVALID", minScore.getCode());

        // bm25 路已开放：应能正常召回，不再报 KB_RETRIEVAL_MODE_UNSUPPORTED。
        RetrievalQueryParam bm25 = query(kb.getKbId(), "Redis");
        bm25.setMode("bm25");
        RetrievalResultView bm25Result = retrievalService.retrieve(bm25, caller);
        assertEquals("bm25", bm25Result.getMode());

        // 未知模式必须报错，并说清可选值。
        KBException mode = assertThrows(KBException.class, () -> {
            RetrievalQueryParam param = query(kb.getKbId(), "Redis");
            param.setMode("magic");
            retrievalService.retrieve(param, caller);
        });
        assertEquals("KB_RETRIEVAL_MODE_UNSUPPORTED", mode.getCode());

        RetrievalQueryParam strict = query(kb.getKbId(), "Redis");
        strict.setMinScore(1.0d);
        strict.setTopK(1);
        RetrievalResultView strictResult = retrievalService.retrieve(strict, caller);
        assertTrue(strictResult.getHits().isEmpty());
        assertEquals(0, strictResult.getReturned());

        KBException foreign = assertThrows(KBException.class,
                () -> retrievalService.retrieve(query(kb.getKbId(), "Redis"),
                        KbCaller.of("t-other", "u-other")));
        assertEquals("KB_NOT_FOUND", foreign.getCode());
    }

    @Test
    @DisplayName("版本过滤：物料换版后旧版本检索块不再进入候选")
    void excludesChunksOfPreviousVersion() {
        KbCaller caller = KbCaller.of(TENANT, ACTOR);
        KnowledgeBaseView kb = createKb(caller);
        String materialId = registerText(kb.getKbId(), "版本过滤",
                "# 旧版\n\n旧版本正文提到 Solr。" + "旧版说明。".repeat(40), caller);
        compilationService.run(materialId, null, caller);
        assertFalse(retrievalService.retrieve(query(kb.getKbId(), "Solr"), caller).getHits().isEmpty());

        byte[] revised = ("# 新版\n\n新版本正文只讲 Elasticsearch。" + "新版说明。".repeat(40))
                .getBytes(StandardCharsets.UTF_8);
        MaterialUploadItem item = materialService.revise(kb.getKbId(), materialId,
                new MaterialUploadFile("new.md", revised.length, revised), null, caller);
        assertTrue(item.isSuccess(), item.getMessage());

        RetrievalResultView result = retrievalService.retrieve(query(kb.getKbId(), "Solr"), caller);
        assertEquals(0, result.getTotalCandidates());
        assertEquals(0, result.getReturned());
        assertTrue(result.getHits().isEmpty());
    }

    private RetrievalQueryParam query(String kbId, String text) {
        RetrievalQueryParam param = new RetrievalQueryParam();
        param.setKbId(kbId);
        param.setQuery(text);
        return param;
    }

    private KnowledgeBaseView createKb(KbCaller caller) {
        KnowledgeBase kb = new KnowledgeBase();
        kb.setName("检索测试库");
        kb.setCode("ret_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        kb.setType(KnowledgeBaseType.FILE);
        return resourceService.create(kb, caller);
    }

    private String registerText(String kbId, String title, String content, KbCaller caller) {
        MaterialUploadItem item = materialService.registerText(kbId, title, null, content, caller);
        assertTrue(item.isSuccess(), item.getMessage());
        return item.getMaterialId();
    }
}
