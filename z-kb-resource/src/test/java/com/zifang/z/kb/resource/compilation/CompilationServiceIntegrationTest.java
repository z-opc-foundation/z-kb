package com.zifang.z.kb.resource.compilation;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.compilation.CompilationBatchCreateParam;
import com.zifang.z.kb.api.compilation.CompilationBatchMemberView;
import com.zifang.z.kb.api.compilation.CompilationBatchPageView;
import com.zifang.z.kb.api.compilation.CompilationBatchService;
import com.zifang.z.kb.api.compilation.CompilationBatchView;
import com.zifang.z.kb.api.compilation.CompilationJobView;
import com.zifang.z.kb.api.compilation.CompilationService;
import com.zifang.z.kb.api.compilation.RetrievalChunkView;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.material.MaterialUploadItem;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBase;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.resource.KnowledgeBaseType;
import com.zifang.z.kb.api.resource.KnowledgeBaseView;
import com.zifang.z.kb.resource.KbResourceTestApplication;
import com.zifang.z.kb.storage.compilation.entity.CompilationJobEntity;
import com.zifang.z.kb.storage.compilation.entity.RetrievalChunkEntity;
import com.zifang.z.kb.storage.compilation.mapper.CompilationJobMapper;
import com.zifang.z.kb.storage.compilation.mapper.RetrievalChunkMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 编译域集成测试：真起 Spring 容器 + H2，钉住 P0–P4 同步编排、产物版本、检索块与组别口径。
 */
@SpringBootTest(classes = KbResourceTestApplication.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:zkb-compilation;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "zkb.storage.path=target/test-kb/compilation-zkb.json",
        "zkb.material.storage.root=target/test-kb/compilation-original",
        "zkb.material.repo.root=target/test-kb/compilation-repo",
        "spring.main.banner-mode=off"
})
class CompilationServiceIntegrationTest {

    private static final String TENANT = "t-compilation";
    private static final String ACTOR = "u-compilation-owner";

    @Autowired
    private KnowledgeBaseResourceService resourceService;

    @Autowired
    private MaterialService materialService;

    @Autowired
    private CompilationService compilationService;

    @Autowired
    private CompilationBatchService batchService;

    @Autowired
    private RetrievalChunkMapper chunkMapper;

    @Autowired
    private CompilationJobMapper jobMapper;

    private KnowledgeBaseView createKb(KbCaller caller) {
        KnowledgeBase kb = new KnowledgeBase();
        kb.setName("编译测试库");
        kb.setCode("cmp_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        kb.setType(KnowledgeBaseType.FILE);
        return resourceService.create(kb, caller);
    }

    private String registerText(String kbId, String title, String content, KbCaller caller) {
        MaterialUploadItem item = materialService.registerText(kbId, title, null, content, caller);
        assertTrue(item.isSuccess(), item.getMessage());
        assertEquals("READY", item.getParseStatus());
        return item.getMaterialId();
    }

    @Test
    @DisplayName("单文件编译：P0–P4 全成功，产出已发布检索块产物，可检索并可重跑")
    void runCompilesMaterialAndKeepsArtifactVersions() {
        KbCaller caller = KbCaller.of(TENANT, ACTOR);
        KnowledgeBaseView kb = createKb(caller);
        String content = "# 架构说明\n\nz-kb 使用 InfluxDB 存储指标，Redis 作为缓存。\n\n"
                + "## 细节\n\nKafka 承担消息队列，Prometheus 负责采集。\n\n"
                + "### 检索\n\n检索块按标题切分，索引阶段写入词法索引。\n\n"
                + "重复段落用于撑开分块：" + repeat("检索与编译链路验证。", 40);
        String materialId = registerText(kb.getKbId(), "架构说明", content, caller);

        CompilationJobView job = compilationService.run(materialId, null, caller);
        assertEquals("COMPLETED", job.getRunStatus());
        assertEquals("M2", job.getMilestone());
        assertNotNull(job.getM1At());
        assertNotNull(job.getM2At());
        assertEquals(1, job.getTotalCount());
        assertEquals(1, job.getSuccessCount());
        assertEquals(0, job.getFailedCount());
        assertEquals("SINGLE", job.getScopeType());
        assertEquals("DOCUMENT", job.getPipelineType());
        assertFalse(job.isReused());
        assertEquals(5, job.getStages().size());
        List<String> stageNames = Arrays.asList("REGISTER", "PARSE", "CHUNK", "INDEX", "EXTRACT");
        for (int i = 0; i < stageNames.size(); i++) {
            assertEquals(stageNames.get(i), job.getStages().get(i).getStage());
            assertEquals("SUCCEEDED", job.getStages().get(i).getStatus());
            assertEquals(1, job.getStages().get(i).getAttempt());
        }
        assertNotNull(job.getArtifact());
        assertEquals("RETRIEVAL_CHUNK", job.getArtifact().getArtifactType());
        assertEquals("PUBLISHED", job.getArtifact().getLifecycleStatus());
        assertEquals("INDEXED", job.getArtifact().getRetrievalState());
        assertEquals(1, job.getArtifact().getVersionNo());
        assertEquals("retrieval-chunk-set:" + job.getArtifact().getCurrentVersionId(),
                job.getArtifact().getStorageRef());
        assertTrue(job.getArtifact().getEvidenceRef().startsWith("parsed_draft:"));
        assertTrue(job.getChunkCount() >= 2);
        assertEquals(expectedHash(TENANT, job), job.getArtifact().getContentHash());

        List<RetrievalChunkView> chunks = compilationService.listChunks(materialId, null, 0, caller);
        assertFalse(chunks.isEmpty());
        int previous = 0;
        for (RetrievalChunkView chunk : chunks) {
            assertTrue(chunk.getOrdinal() > previous);
            previous = chunk.getOrdinal();
            assertEquals("INDEXED", chunk.getIndexState());
            assertNotNull(chunk.getContent());
        }

        List<RetrievalChunkView> hits = compilationService.search(kb.getKbId(), "InfluxDB", 0, caller);
        assertFalse(hits.isEmpty());
        assertTrue(hits.get(0).getContent().contains("InfluxDB"));

        CompilationJobView byMaterial = compilationService.queryByMaterial(materialId, null, caller);
        assertNotNull(byMaterial);
        assertEquals(job.getJobId(), byMaterial.getJobId());
        assertEquals(1, compilationService.listScope(job.getJobId(), caller).size());
        assertEquals(1, compilationService.listByKb(kb.getKbId(), materialId, 0, caller).size());

        CompilationJobView reused = compilationService.run(materialId, null, caller);
        assertTrue(reused.isReused());
        assertEquals(job.getJobId(), reused.getJobId());

        CompilationJobView retired = compilationService.retry(job.getJobId(), "P2", caller);
        assertEquals("COMPLETED", retired.getRunStatus());
        assertEquals(2, retired.getStages().get(0).getAttempt());
        assertEquals("SKIPPED", retired.getStages().get(0).getStatus());
        assertEquals("SKIPPED", retired.getStages().get(1).getStatus());
        assertEquals("SUCCEEDED", retired.getStages().get(2).getStatus());
        assertEquals(2, retired.getArtifact().getVersionNo());
        assertTrue(retired.getChunkCount() > 0);
        assertEquals(job.getChunkCount(), retired.getChunkCount());
        assertFalse(compilationService.search(kb.getKbId(), "InfluxDB", 0, caller).isEmpty());

        CompilationJobView canceled = compilationService.cancel(job.getJobId(), caller);
        assertTrue(canceled.isReused());
        assertEquals("COMPLETED", canceled.getRunStatus());
    }

    @Test
    @DisplayName("组别编译：多文件共用作业，成员按文件投影，终态后不再占用运行锁")
    void batchCompilesMultipleMaterials() {
        KbCaller caller = KbCaller.of(TENANT, ACTOR);
        KnowledgeBaseView kb = createKb(caller);
        String first = registerText(kb.getKbId(), "第一份",
                "# 第一章\n\nMySQL 与 PostgreSQL 的对比。" + repeat("数据库选型说明。", 20), caller);
        String second = registerText(kb.getKbId(), "第二份",
                "# 第二章\n\nKafka 与 RocketMQ 的对比。" + repeat("消息队列选型说明。", 20), caller);

        CompilationBatchCreateParam param = new CompilationBatchCreateParam();
        param.setKbId(kb.getKbId());
        param.setScopeType("WORKSPACE");
        param.setMaterialIds(new ArrayList<>(Arrays.asList(first, second)));
        CompilationBatchView batch = batchService.create(param, caller);

        assertEquals("COMPLETED", batch.getStatus());
        assertEquals("WORKSPACE", batch.getScopeType());
        assertEquals(2, batch.getTotalCount());
        assertEquals(2, batch.getSuccessCount());
        assertEquals(0, batch.getFailedCount());
        assertEquals(2, batch.getMembers().size());
        List<String> memberIds = new ArrayList<>();
        for (CompilationBatchMemberView member : batch.getMembers()) {
            memberIds.add(member.getMaterialId());
            assertEquals("COMPLETED", member.getItemStatus());
            assertEquals("M2", member.getMilestone());
            assertTrue(member.getChunkCount() > 0);
        }
        assertEquals(Arrays.asList(first, second), memberIds);
        assertEquals(1, batchService.listByKb(kb.getKbId(), 0, caller).size());
        CompilationBatchPageView page = batchService.pageByKb(kb.getKbId(), 1, 10, caller);
        assertEquals(1, page.getTotal());
        assertEquals(1, page.getRecords().size());
        assertEquals(batch.getBatchId(), page.getRecords().get(0).getBatchId());
        assertFalse(batchService.hasRunning(kb.getKbId(), caller));
        assertEquals(2, batchService.query(batch.getBatchId(), caller).getMembers().size());
        assertEquals(batch.getBatchId(),
                compilationService.queryByJobId(batch.getBatchId(), caller).getJobId());
        assertThrows(KBException.class, () -> batchService.query(batch.getBatchId() + "-x", caller));
    }

    @Test
    @DisplayName("范围与状态保护：非法 scopeType、非组别标识、运行中组别互斥")
    void guardsBatchScopeAndRunningLock() {
        KbCaller caller = KbCaller.of(TENANT, ACTOR);
        KnowledgeBaseView kb = createKb(caller);
        String materialId = registerText(kb.getKbId(), "互斥验证", "# 互斥\n\n正文。", caller);

        CompilationBatchCreateParam invalid = new CompilationBatchCreateParam();
        invalid.setKbId(kb.getKbId());
        invalid.setScopeType("SINGLE");
        invalid.setMaterialIds(new ArrayList<>(Arrays.asList(materialId)));
        KBException scopeError = assertThrows(KBException.class,
                () -> batchService.create(invalid, caller));
        assertEquals("COMPILATION_SCOPE_TYPE_INVALID", scopeError.getCode());

        CompilationJobView single = compilationService.run(materialId, null, caller);
        KBException notBatch = assertThrows(KBException.class,
                () -> batchService.query(single.getJobId(), caller));
        assertEquals("COMPILATION_BATCH_NOT_FOUND", notBatch.getCode());

        insertRunningBatch(caller, kb.getKbId());
        CompilationBatchCreateParam blocked = new CompilationBatchCreateParam();
        blocked.setKbId(kb.getKbId());
        blocked.setScopeType("WORKSPACE");
        blocked.setMaterialIds(new ArrayList<>(Arrays.asList(materialId)));
        KBException running = assertThrows(KBException.class,
                () -> batchService.create(blocked, caller));
        assertEquals("COMPILATION_BATCH_RUNNING", running.getCode());
    }

    private void insertRunningBatch(KbCaller caller, String kbId) {
        Instant now = Instant.now();
        CompilationJobEntity job = new CompilationJobEntity();
        String id = UUID.randomUUID().toString();
        job.setId(id);
        job.setJobId(id);
        job.setTenantCode(caller.getTenantCode());
        job.setKbId(kbId);
        job.setName("运行中的组别");
        job.setTaskType("COMPILATION");
        job.setScopeType("WORKSPACE");
        job.setScopeCount(1);
        job.setTotalCount(1);
        job.setSuccessCount(0);
        job.setFailedCount(0);
        job.setInputSnapshot("[]");
        job.setPipelineType("DOCUMENT");
        job.setConfigVersion("v1");
        job.setConfigSnapshot("{}");
        job.setCompilerVersion("local-chunker-v2");
        job.setRunStatus("RUNNING");
        job.setMilestone("NONE");
        job.setChunkCount(0);
        job.setRoundNo(1);
        job.setIsDeleted(0);
        job.setCreateBy(caller.getActorId());
        job.setUpdateBy(caller.getActorId());
        job.setCreateTime(now);
        job.setUpdateTime(now);
        jobMapper.insert(job);
    }

    private String expectedHash(String tenant, CompilationJobView job) {
        QueryWrapper<RetrievalChunkEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("artifact_version_id",
                        job.getArtifact().getCurrentVersionId())
                .eq("chunk_role", "PASSAGE").eq("is_deleted", 0).orderByAsc("ordinal");
        StringBuilder joined = new StringBuilder();
        for (RetrievalChunkEntity chunk : chunkMapper.selectList(query)) {
            joined.append(chunk.getContent()).append('\n');
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(joined.toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16));
                hex.append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private String repeat(String text, int times) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < times; i++) {
            builder.append(text);
        }
        return builder.toString();
    }
}
