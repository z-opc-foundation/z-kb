package com.zifang.z.kb.resource.compilation;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.zifang.z.kb.api.compilation.ArtifactStatus;
import com.zifang.z.kb.api.compilation.ArtifactType;
import com.zifang.z.kb.api.compilation.ChunkRole;
import com.zifang.z.kb.api.compilation.CompilationStage;
import com.zifang.z.kb.api.compilation.RetrievalState;
import com.zifang.z.kb.api.extraction.ExtractionChunk;
import com.zifang.z.kb.api.extraction.ExtractionCountView;
import com.zifang.z.kb.api.extraction.ExtractionInput;
import com.zifang.z.kb.api.extraction.ExtractionService;
import com.zifang.z.kb.api.material.MaterialCompileSource;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.core.compilation.MarkdownChunker;
import com.zifang.z.kb.storage.compilation.entity.ArtifactEntity;
import com.zifang.z.kb.storage.compilation.entity.ArtifactVersionEntity;
import com.zifang.z.kb.storage.compilation.entity.CompilationJobEntity;
import com.zifang.z.kb.storage.compilation.entity.RetrievalChunkEntity;
import com.zifang.z.kb.storage.compilation.mapper.ArtifactMapper;
import com.zifang.z.kb.storage.compilation.mapper.ArtifactVersionMapper;
import com.zifang.z.kb.storage.compilation.mapper.RetrievalChunkMapper;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static com.zifang.z.kb.resource.compilation.CompilationSupport.COMPILER_VERSION;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.sourceNotReady;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.statusInvalid;
import static com.zifang.z.kb.resource.compilation.CompilationSupport.truncate;

/**
 * 单个编译步骤的事务性执行：P0 登记、P1 解析、P2 拆块、P3 建索引、P4 萃取。
 *
 * <p>z-kb 没有独立任务内核，步骤在调用线程内同步执行；状态推进由
 * {@code DefaultCompilationService} 写阶段行，本类只负责副作用。</p>
 */
public class CompilationStageRunner {

    private final MarkdownChunker chunker = new MarkdownChunker();

    private final ArtifactMapper artifactMapper;
    private final ArtifactVersionMapper artifactVersionMapper;
    private final RetrievalChunkMapper chunkMapper;
    private final ExtractionService extractionService;

    public CompilationStageRunner(ArtifactMapper artifactMapper,
                                  ArtifactVersionMapper artifactVersionMapper,
                                  RetrievalChunkMapper chunkMapper,
                                  ExtractionService extractionService) {
        this.artifactMapper = artifactMapper;
        this.artifactVersionMapper = artifactVersionMapper;
        this.chunkMapper = chunkMapper;
        this.extractionService = extractionService;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public Outcome execute(CompilationJobEntity job, CompilationStage stage,
                           MaterialCompileSource source, KbCaller caller) {
        switch (stage) {
            case REGISTER:
                return register(source);
            case PARSE:
                return parse(source);
            case CHUNK:
                return chunk(job, source, caller);
            case INDEX:
                return index(job, source, caller);
            case EXTRACT:
                return extract(job, source, caller);
            default:
                throw statusInvalid();
        }
    }

    /** 登记步骤：确认物料版本与解析稿可读，本身不写业务数据。 */
    private Outcome register(MaterialCompileSource source) {
        return new Outcome(null, 0, "已登记物料版本 v" + source.getVersionNo()
                + "（" + source.getVersionId() + "）");
    }

    /** 解析步骤：校验解析稿正文，记录复用来源与正文长度。 */
    private Outcome parse(MaterialCompileSource source) {
        if (!CompilationSupport.hasText(source.getTextContent())) {
            throw sourceNotReady();
        }
        return new Outcome(null, 0, "复用解析稿 " + source.getDraftId() + "，正文 "
                + source.getTextContent().length() + " 字符");
    }

    /** 拆解步骤：按标题切块并写入未索引检索块，同时登记检索块产物与版本。 */
    private Outcome chunk(CompilationJobEntity job, MaterialCompileSource source, KbCaller caller) {
        if (!CompilationSupport.hasText(source.getTextContent())) {
            throw sourceNotReady();
        }
        String tenant = job.getTenantCode();
        Instant now = Instant.now();
        List<MarkdownChunker.Chunk> drafts = chunker.split(source.getTextContent(), source.getTitle());
        chunkMapper.delete(new QueryWrapper<RetrievalChunkEntity>()
                .eq("tenant_code", tenant)
                .eq("material_version_id", source.getVersionId()));

        String artifactVersionId = UUID.randomUUID().toString();
        ArtifactEntity artifact = findChunkArtifact(tenant, source.getVersionId());
        if (artifact == null) {
            artifact = buildArtifact(job, source, artifactVersionId, caller, now);
            artifactMapper.insert(artifact);
        } else {
            artifact.setTitle(truncate(source.getTitle() + " · 检索块", 255));
            artifact.setLifecycleStatus(ArtifactStatus.DRAFT.name());
            artifact.setRetrievalState(RetrievalState.NOT_INDEXED.name());
            artifact.setCurrentVersionId(artifactVersionId);
            artifact.setEvidenceRef(evidenceRef(source));
            artifact.setUpdateBy(caller.getActorId());
            artifact.setUpdateTime(now);
            artifactMapper.updateById(artifact);
        }
        artifactVersionMapper.insert(buildArtifactVersion(job, artifact.getArtifactId(),
                artifactVersionId, drafts, caller, now));

        List<String> chunkIds = new ArrayList<>();
        for (int i = 0; i < drafts.size(); i++) {
            chunkIds.add(UUID.randomUUID().toString());
        }
        for (int i = 0; i < drafts.size(); i++) {
            MarkdownChunker.Chunk draft = drafts.get(i);
            RetrievalChunkEntity chunk = new RetrievalChunkEntity();
            chunk.setId(UUID.randomUUID().toString());
            chunk.setChunkId(chunkIds.get(i));
            chunk.setTenantCode(tenant);
            chunk.setKbId(job.getKbId());
            chunk.setSourceType("MATERIAL");
            chunk.setSourceId(source.getMaterialId());
            chunk.setSourceVersionId(source.getVersionId());
            if (draft.getParentIndex() >= 0 && draft.getParentIndex() < chunkIds.size()) {
                chunk.setParentChunkId(chunkIds.get(draft.getParentIndex()));
            }
            chunk.setChunkRole(draft.getRole().name());
            chunk.setMaterialId(source.getMaterialId());
            chunk.setMaterialVersionId(source.getVersionId());
            chunk.setArtifactId(artifact.getArtifactId());
            chunk.setArtifactVersionId(artifactVersionId);
            chunk.setOrdinal(i + 1);
            chunk.setHeading(draft.getHeading());
            chunk.setContent(draft.getContent());
            chunk.setCharCount(draft.getContent().length());
            chunk.setIndexState(RetrievalState.NOT_INDEXED.name());
            chunk.setIsDeleted(0);
            chunk.setCreateBy(caller.getActorId());
            chunk.setUpdateBy(caller.getActorId());
            chunk.setCreateTime(now);
            chunk.setUpdateTime(now);
            chunkMapper.insert(chunk);
        }
        String detail = "生成 " + drafts.size() + " 个检索块";
        if (drafts.size() >= MarkdownChunker.MAX_CHUNKS) {
            detail += "，超出单文件上限 " + MarkdownChunker.MAX_CHUNKS + "，已截断";
        }
        return new Outcome(artifact.getArtifactId(), drafts.size(), detail);
    }

    /** 索引步骤：把该版本的检索块统一翻转为已索引，并发布检索块产物。 */
    private Outcome index(CompilationJobEntity job, MaterialCompileSource source, KbCaller caller) {
        String tenant = job.getTenantCode();
        List<RetrievalChunkEntity> chunks = chunksOfVersion(tenant, source.getVersionId());
        if (chunks.isEmpty()) {
            throw statusInvalid();
        }
        Instant now = Instant.now();
        chunkMapper.update(null, new UpdateWrapper<RetrievalChunkEntity>()
                .eq("tenant_code", tenant)
                .eq("material_version_id", source.getVersionId())
                .ne("index_state", RetrievalState.INDEXED.name())
                .set("index_state", RetrievalState.INDEXED.name())
                .set("indexed_at", now)
                .set("update_by", caller.getActorId())
                .set("update_time", now));
        ArtifactEntity artifact = findChunkArtifact(tenant, source.getVersionId());
        if (artifact == null) {
            throw statusInvalid();
        }
        artifact.setLifecycleStatus(ArtifactStatus.PUBLISHED.name());
        artifact.setRetrievalState(RetrievalState.INDEXED.name());
        artifact.setPublishedAt(now);
        artifact.setUpdateBy(caller.getActorId());
        artifact.setUpdateTime(now);
        artifactMapper.updateById(artifact);
        return new Outcome(artifact.getArtifactId(), chunks.size(),
                "本地词法索引已写入 " + chunks.size() + " 个检索块");
    }

    /** 萃取步骤：基于已索引检索块做本地规则萃取，落库摘要/问句/术语/FAQ 与图谱。 */
    private Outcome extract(CompilationJobEntity job, MaterialCompileSource source, KbCaller caller) {
        List<RetrievalChunkEntity> stored = chunksOfVersion(job.getTenantCode(), source.getVersionId());
        if (stored.isEmpty()) {
            throw statusInvalid();
        }
        ExtractionInput input = new ExtractionInput();
        input.setKbId(job.getKbId());
        input.setMaterialId(source.getMaterialId());
        input.setMaterialVersionId(source.getVersionId());
        input.setMaterialTitle(source.getTitle());
        input.setDraftId(source.getDraftId());
        List<ExtractionChunk> passages = new ArrayList<>();
        for (RetrievalChunkEntity row : stored) {
            if (!ChunkRole.PASSAGE.name().equals(row.getChunkRole())) {
                continue;
            }
            passages.add(new ExtractionChunk(row.getOrdinal(), row.getHeading(), row.getContent()));
        }
        input.setChunks(passages);
        ExtractionCountView counts = extractionService.extract(input, caller);
        int items = counts.getSummary() + counts.getQuestion() + counts.getTerm()
                + counts.getFaq();
        String detail = "本地规则萃取 摘要" + counts.getSummary() + "/问句" + counts.getQuestion()
                + "/术语" + counts.getTerm() + "/FAQ" + counts.getFaq()
                + "；图谱节点" + counts.getGraphNode() + " 边" + counts.getGraphEdge();
        return new Outcome(null, items, detail);
    }

    private List<RetrievalChunkEntity> chunksOfVersion(String tenant, String versionId) {
        QueryWrapper<RetrievalChunkEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("material_version_id", versionId)
                .eq("is_deleted", 0).orderByAsc("ordinal");
        return chunkMapper.selectList(query);
    }

    private ArtifactEntity findChunkArtifact(String tenant, String materialVersionId) {
        QueryWrapper<ArtifactEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("material_version_id", materialVersionId)
                .eq("artifact_type", ArtifactType.RETRIEVAL_CHUNK.name())
                .eq("is_deleted", 0)
                .orderByAsc("create_time")
                .last("LIMIT 1");
        return artifactMapper.selectOne(query);
    }

    private ArtifactEntity buildArtifact(CompilationJobEntity job, MaterialCompileSource source,
                                         String artifactVersionId, KbCaller caller, Instant now) {
        ArtifactEntity artifact = new ArtifactEntity();
        artifact.setId(UUID.randomUUID().toString());
        artifact.setArtifactId(UUID.randomUUID().toString());
        artifact.setTenantCode(job.getTenantCode());
        artifact.setKbId(job.getKbId());
        artifact.setMaterialId(source.getMaterialId());
        artifact.setMaterialVersionId(source.getVersionId());
        artifact.setArtifactType(ArtifactType.RETRIEVAL_CHUNK.name());
        artifact.setTitle(truncate(source.getTitle() + " · 检索块", 255));
        artifact.setLifecycleStatus(ArtifactStatus.DRAFT.name());
        artifact.setRetrievalState(RetrievalState.NOT_INDEXED.name());
        artifact.setCurrentVersionId(artifactVersionId);
        artifact.setEvidenceRef(evidenceRef(source));
        artifact.setCreatedBy(caller.getActorId());
        artifact.setIsDeleted(0);
        artifact.setCreateBy(caller.getActorId());
        artifact.setUpdateBy(caller.getActorId());
        artifact.setCreateTime(now);
        artifact.setUpdateTime(now);
        return artifact;
    }

    private ArtifactVersionEntity buildArtifactVersion(CompilationJobEntity job, String artifactId,
                                                       String artifactVersionId,
                                                       List<MarkdownChunker.Chunk> drafts,
                                                       KbCaller caller, Instant now) {
        StringBuilder joined = new StringBuilder();
        for (MarkdownChunker.Chunk draft : drafts) {
            if (draft.getRole() == ChunkRole.PASSAGE) {
                joined.append(draft.getContent()).append('\n');
            }
        }
        ArtifactVersionEntity version = new ArtifactVersionEntity();
        version.setId(UUID.randomUUID().toString());
        version.setArtifactVersionId(artifactVersionId);
        version.setTenantCode(job.getTenantCode());
        version.setArtifactId(artifactId);
        version.setVersionNo(nextVersionNo(job.getTenantCode(), artifactId));
        version.setContentHash(sha256(joined.toString()));
        version.setStorageRef("retrieval-chunk-set:" + artifactVersionId);
        version.setCompilerVersion(COMPILER_VERSION);
        version.setConfigVersion(job.getConfigVersion());
        version.setIsDeleted(0);
        version.setCreateBy(caller.getActorId());
        version.setUpdateBy(caller.getActorId());
        version.setCreateTime(now);
        version.setUpdateTime(now);
        return version;
    }

    /** 取产物历史版本的最大版本号加一，首次发布返回 1。 */
    private int nextVersionNo(String tenant, String artifactId) {
        QueryWrapper<ArtifactVersionEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("artifact_id", artifactId).eq("is_deleted", 0)
                .orderByDesc("version_no").last("LIMIT 1");
        ArtifactVersionEntity latest = artifactVersionMapper.selectOne(query);
        return latest == null || latest.getVersionNo() == null ? 1 : latest.getVersionNo() + 1;
    }

    private static String evidenceRef(MaterialCompileSource source) {
        return "parsed_draft:" + (source.getDraftId() == null ? "" : source.getDraftId());
    }

    /** 计算字符串的 SHA-256 十六进制摘要，供产物版本内容比对。 */
    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16));
                hex.append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }

    /** 步骤执行结果：产物标识、条目数与结果说明。 */
    static final class Outcome {

        private final String artifactId;
        private final int itemCount;
        private final String detail;

        Outcome(String artifactId, int itemCount, String detail) {
            this.artifactId = artifactId;
            this.itemCount = itemCount;
            this.detail = detail;
        }

        String getArtifactId() {
            return artifactId;
        }

        int getItemCount() {
            return itemCount;
        }

        String getDetail() {
            return detail;
        }
    }
}
