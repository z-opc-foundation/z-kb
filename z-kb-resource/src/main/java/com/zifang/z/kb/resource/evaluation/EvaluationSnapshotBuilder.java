package com.zifang.z.kb.resource.evaluation;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.compilation.ArtifactStatus;
import com.zifang.z.kb.api.compilation.RetrievalState;
import com.zifang.z.kb.api.evaluation.EvalSnapshotItemType;
import com.zifang.z.kb.api.evaluation.EvalSnapshotStatus;
import com.zifang.z.kb.api.evaluation.EvaluationStatusCode;
import com.zifang.z.kb.core.retrieval.LocalHashEmbedding;
import com.zifang.z.kb.storage.compilation.entity.ArtifactEntity;
import com.zifang.z.kb.storage.compilation.entity.ArtifactVersionEntity;
import com.zifang.z.kb.storage.compilation.entity.RetrievalChunkEntity;
import com.zifang.z.kb.storage.compilation.mapper.ArtifactMapper;
import com.zifang.z.kb.storage.compilation.mapper.ArtifactVersionMapper;
import com.zifang.z.kb.storage.compilation.mapper.RetrievalChunkMapper;
import com.zifang.z.kb.storage.evaluation.entity.KbSnapshotEntity;
import com.zifang.z.kb.storage.evaluation.entity.KbSnapshotItemEntity;
import com.zifang.z.kb.storage.evaluation.mapper.KbSnapshotItemMapper;
import com.zifang.z.kb.storage.evaluation.mapper.KbSnapshotMapper;
import com.zifang.z.kb.storage.material.entity.MaterialEntity;
import com.zifang.z.kb.storage.material.entity.MaterialVersionEntity;
import com.zifang.z.kb.storage.material.mapper.MaterialMapper;
import com.zifang.z.kb.storage.material.mapper.MaterialVersionMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.hasText;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.sha256;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.text;
import static com.zifang.z.kb.resource.evaluation.EvaluationSupport.toJson;

/**
 * 评测快照构建：按物料与产物的当前版本生成成员条目、指纹与索引代际，可复用同指纹快照。
 */
final class EvaluationSnapshotBuilder {

    private final MaterialMapper materialMapper;

    private final MaterialVersionMapper materialVersionMapper;

    private final ArtifactMapper artifactMapper;

    private final ArtifactVersionMapper artifactVersionMapper;

    private final RetrievalChunkMapper retrievalChunkMapper;

    private final KbSnapshotMapper kbSnapshotMapper;

    private final KbSnapshotItemMapper kbSnapshotItemMapper;

    private final LocalHashEmbedding embedding;

    EvaluationSnapshotBuilder(MaterialMapper materialMapper,
            MaterialVersionMapper materialVersionMapper,
            ArtifactMapper artifactMapper,
            ArtifactVersionMapper artifactVersionMapper,
            RetrievalChunkMapper retrievalChunkMapper,
            KbSnapshotMapper kbSnapshotMapper,
            KbSnapshotItemMapper kbSnapshotItemMapper,
            LocalHashEmbedding embedding) {
        this.materialMapper = materialMapper;
        this.materialVersionMapper = materialVersionMapper;
        this.artifactMapper = artifactMapper;
        this.artifactVersionMapper = artifactVersionMapper;
        this.retrievalChunkMapper = retrievalChunkMapper;
        this.kbSnapshotMapper = kbSnapshotMapper;
        this.kbSnapshotItemMapper = kbSnapshotItemMapper;
        this.embedding = embedding;
    }

    /** 构建知识库快照：按物料与加工件的当前版本生成条目、指纹与索引代际，已存在则直接复用。 */
    SnapshotBuild buildSnapshot(String tenantCode, String kbId, String configVersion,
            String ontologyVersion, String actorId) {
        List<MaterialEntity> materials = materialMapper.selectList(
                new QueryWrapper<MaterialEntity>()
                        .eq("tenant_code", tenantCode)
                        .eq("kb_id", kbId)
                        .eq("is_deleted", 0)
                        .isNotNull("current_version_id")
                        .ne("current_version_id", "")
                        .orderByAsc("material_id"));
        Set<String> materialVersionIds = new LinkedHashSet<>();
        for (MaterialEntity material : materials) {
            materialVersionIds.add(material.getCurrentVersionId());
        }
        Map<String, MaterialVersionEntity> versionMap = new HashMap<>();
        if (!materialVersionIds.isEmpty()) {
            for (MaterialVersionEntity version : materialVersionMapper.selectList(
                    new QueryWrapper<MaterialVersionEntity>()
                            .eq("tenant_code", tenantCode)
                            .eq("is_deleted", 0)
                            .in("version_id", materialVersionIds))) {
                versionMap.put(version.getVersionId(), version);
            }
        }
        List<ArtifactEntity> artifacts = artifactMapper.selectList(
                new QueryWrapper<ArtifactEntity>()
                        .eq("tenant_code", tenantCode)
                        .eq("kb_id", kbId)
                        .eq("is_deleted", 0)
                        .isNotNull("current_version_id")
                        .ne("current_version_id", "")
                        .notIn("lifecycle_status", Arrays.asList(
                                ArtifactStatus.INVALIDATED.name(),
                                ArtifactStatus.ARCHIVED.name()))
                        .orderByAsc("artifact_id"));
        Set<String> artifactVersionIds = new LinkedHashSet<>();
        for (ArtifactEntity artifact : artifacts) {
            artifactVersionIds.add(artifact.getCurrentVersionId());
        }
        Map<String, ArtifactVersionEntity> artifactVersionMap = new HashMap<>();
        if (!artifactVersionIds.isEmpty()) {
            for (ArtifactVersionEntity version : artifactVersionMapper.selectList(
                    new QueryWrapper<ArtifactVersionEntity>()
                            .eq("tenant_code", tenantCode)
                            .eq("is_deleted", 0)
                            .in("artifact_version_id", artifactVersionIds))) {
                artifactVersionMap.put(version.getArtifactVersionId(), version);
            }
        }
        List<KbSnapshotItemEntity> items = new ArrayList<>();
        for (MaterialEntity material : materials) {
            MaterialVersionEntity version = versionMap.get(material.getCurrentVersionId());
            KbSnapshotItemEntity item = new KbSnapshotItemEntity();
            item.setId(UUID.randomUUID().toString());
            item.setTenantCode(tenantCode);
            item.setItemType(EvalSnapshotItemType.MATERIAL.name());
            item.setItemKey("MATERIAL:" + material.getMaterialId());
            item.setMaterialId(material.getMaterialId());
            item.setMaterialVersionId(material.getCurrentVersionId());
            item.setChecksum(version == null || !hasText(version.getFingerprint())
                    ? sha256(material.getCurrentVersionId()) : version.getFingerprint());
            item.setCreateBy(actorId);
            item.setUpdateBy(actorId);
            items.add(item);
        }
        for (ArtifactEntity artifact : artifacts) {
            ArtifactVersionEntity version = artifactVersionMap.get(artifact.getCurrentVersionId());
            KbSnapshotItemEntity item = new KbSnapshotItemEntity();
            item.setId(UUID.randomUUID().toString());
            item.setTenantCode(tenantCode);
            item.setItemType(EvalSnapshotItemType.ARTIFACT.name());
            item.setItemKey("ARTIFACT:" + artifact.getArtifactId());
            item.setMaterialId(artifact.getMaterialId());
            item.setMaterialVersionId(artifact.getMaterialVersionId());
            item.setArtifactType(artifact.getArtifactType());
            item.setArtifactVersionId(artifact.getCurrentVersionId());
            item.setChecksum(version == null || !hasText(version.getContentHash())
                    ? sha256(artifact.getCurrentVersionId()) : version.getContentHash());
            item.setCreateBy(actorId);
            item.setUpdateBy(actorId);
            items.add(item);
        }
        items.sort(Comparator.comparing(KbSnapshotItemEntity::getItemKey));
        if (items.isEmpty()) {
            throw new KBException(EvaluationStatusCode.EVAL_SNAPSHOT_EMPTY.code(),
                    EvaluationStatusCode.EVAL_SNAPSHOT_EMPTY.message());
        }
        List<String> keys = new ArrayList<>();
        for (KbSnapshotItemEntity item : items) {
            keys.add(item.getItemKey());
        }
        List<String> fingerprintKeys = new ArrayList<>();
        for (KbSnapshotItemEntity item : items) {
            fingerprintKeys.add(item.getItemKey() + "@" + text(item.getChecksum()));
        }
        String fingerprint = sha256(String.join("|", fingerprintKeys));
        String indexGeneration = embedding.model() + "@384|" + fingerprint.substring(0, 12);
        KbSnapshotEntity existing = existingSnapshot(tenantCode, kbId, fingerprint,
                indexGeneration);
        if (existing != null) {
            SnapshotBuild build = new SnapshotBuild();
            build.snapshot = existing;
            build.items = kbSnapshotItemMapper.selectList(
                    new QueryWrapper<KbSnapshotItemEntity>()
                            .eq("tenant_code", tenantCode)
                            .eq("snapshot_id", existing.getSnapshotId())
                            .eq("is_deleted", 0)
                            .orderByAsc("item_key"));
            return build;
        }
        Instant now = Instant.now();
        KbSnapshotEntity snapshot = new KbSnapshotEntity();
        snapshot.setId(UUID.randomUUID().toString());
        snapshot.setSnapshotId(UUID.randomUUID().toString());
        snapshot.setTenantCode(tenantCode);
        snapshot.setKbId(kbId);
        snapshot.setConfigVersion(configVersion);
        snapshot.setOntologyVersion(ontologyVersion);
        snapshot.setIndexGeneration(indexGeneration);
        snapshot.setFingerprint(fingerprint);
        snapshot.setStatus(EvalSnapshotStatus.READY.name());
        snapshot.setMaterialCount(materials.size());
        snapshot.setArtifactCount(artifacts.size());
        snapshot.setChunkCount((int) Math.min(countChunks(tenantCode, materialVersionIds, true),
                Integer.MAX_VALUE));
        Map<String, Object> manifest = new LinkedHashMap<>();
        manifest.put("items", keys);
        manifest.put("materialCount", materials.size());
        manifest.put("artifactCount", artifacts.size());
        manifest.put("indexGeneration", indexGeneration);
        manifest.put("fingerprint", fingerprint);
        snapshot.setArtifactManifest(toJson(manifest));
        snapshot.setIsDeleted(0);
        snapshot.setCreateBy(actorId);
        snapshot.setUpdateBy(actorId);
        snapshot.setCreateTime(now);
        snapshot.setUpdateTime(now);
        kbSnapshotMapper.insert(snapshot);
        for (KbSnapshotItemEntity item : items) {
            item.setSnapshotId(snapshot.getSnapshotId());
            item.setIndexGeneration(indexGeneration);
            item.setIsDeleted(0);
            item.setCreateTime(now);
            item.setUpdateTime(now);
            kbSnapshotItemMapper.insert(item);
        }
        SnapshotBuild build = new SnapshotBuild();
        build.snapshot = snapshot;
        build.items = items;
        return build;
    }

    /** 查找同知识库下指纹与索引代际一致、状态为 READY 的最新快照，用于避免重复建快照。 */
    private KbSnapshotEntity existingSnapshot(String tenantCode, String kbId, String fingerprint,
            String indexGeneration) {
        return kbSnapshotMapper.selectOne(new QueryWrapper<KbSnapshotEntity>()
                .eq("tenant_code", tenantCode)
                .eq("kb_id", kbId)
                .eq("fingerprint", fingerprint)
                .eq("index_generation", indexGeneration)
                .eq("status", EvalSnapshotStatus.READY.name())
                .eq("is_deleted", 0)
                .orderByDesc("id")
                .last("limit 1"));
    }

    /**
     * 分批加载快照内物料版本的分块，可限定已索引与召回段落块，按 chunkId 排序后截断到上限。
     *
     * <p>z-kb 的向量在检索时惰性计算，这里不按 embedding 字段过滤；候选块由显式传入的
     * {@code passageOnly} 与 {@code indexedOnly} 共同收敛到 INDEXED 的 PASSAGE 块。</p>
     */
    List<RetrievalChunkEntity> loadChunks(String tenantCode, Collection<String> versionIds,
            boolean indexedOnly, boolean passageOnly, int limit) {
        if (versionIds == null || versionIds.isEmpty()) {
            return new ArrayList<>();
        }
        List<String> ids = new ArrayList<>(versionIds);
        Collections.sort(ids);
        List<RetrievalChunkEntity> rows = new ArrayList<>();
        for (int from = 0; from < ids.size(); from += 500) {
            List<String> batch = ids.subList(from, Math.min(from + 500, ids.size()));
            QueryWrapper<RetrievalChunkEntity> query = new QueryWrapper<RetrievalChunkEntity>()
                    .eq("tenant_code", tenantCode)
                    .eq("is_deleted", 0)
                    .in("material_version_id", batch);
            if (indexedOnly) {
                query.eq("index_state", RetrievalState.INDEXED.name());
            }
            if (passageOnly) {
                query.eq("chunk_role", "PASSAGE");
            }
            rows.addAll(retrievalChunkMapper.selectList(query));
        }
        rows.sort(Comparator.comparing(item -> text(item.getChunkId())));
        if (rows.size() > limit) {
            return new ArrayList<>(rows.subList(0, limit));
        }
        return rows;
    }

    /** 统计快照内物料版本的分块数量，可只统计已索引分块。 */
    long countChunks(String tenantCode, Collection<String> versionIds, boolean indexedOnly) {
        if (versionIds == null || versionIds.isEmpty()) {
            return 0L;
        }
        List<String> ids = new ArrayList<>(versionIds);
        Collections.sort(ids);
        long total = 0L;
        for (int from = 0; from < ids.size(); from += 500) {
            List<String> batch = ids.subList(from, Math.min(from + 500, ids.size()));
            QueryWrapper<RetrievalChunkEntity> query = new QueryWrapper<RetrievalChunkEntity>()
                    .eq("tenant_code", tenantCode)
                    .eq("is_deleted", 0)
                    .in("material_version_id", batch);
            if (indexedOnly) {
                query.eq("index_state", RetrievalState.INDEXED.name());
            }
            Long count = retrievalChunkMapper.selectCount(query);
            total += count == null ? 0L : count;
        }
        return total;
    }

    static final class SnapshotBuild {

        KbSnapshotEntity snapshot;

        List<KbSnapshotItemEntity> items;
    }
}
