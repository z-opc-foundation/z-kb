package com.zifang.z.kb.resource.source;

import com.zifang.z.kb.api.material.MaterialBatchItem;
import com.zifang.z.kb.api.material.MaterialBinding;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.material.MaterialSyncRequest;
import com.zifang.z.kb.api.material.MaterialSyncResult;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.core.source.IngestDocContent;
import com.zifang.z.kb.core.source.IngestDocRef;
import com.zifang.z.kb.core.source.IngestMetadata;
import com.zifang.z.kb.core.source.IngestSyncInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 文档型来源的同步执行器：供应商给出「有哪些文档、每篇的内容版本」，这里负责两级增量、
 * 登记或追加版本，以及把目录里消失的文档标记失效。拉取与登记都复用 {@link MaterialService}。
 */
public class DocIngestRunner {

    private static final Logger LOG = LoggerFactory.getLogger(DocIngestRunner.class);

    private final MaterialService materialService;

    public DocIngestRunner(MaterialService materialService) {
        this.materialService = materialService;
    }

    /**
     * @param scope     来源范围标识（语雀是单库 namespace，Git 是仓库+分支），写进元数据与回执
     * @param refs      本次目录里的全部文档
     * @param versions  文档 slug → 内容版本；取不到时传空表，退化为逐篇比对
     * @param fetcher   按节点拉正文
     */
    public IngestSyncInfo run(String kbId, String sourceId, String sourceType, String scope,
            List<IngestDocRef> refs, Map<String, String> versions, DocContentFetcher fetcher,
            KbCaller caller) {
        return run(kbId, sourceId, sourceType, scope, refs, versions, true, fetcher, caller);
    }

    /**
     * @param allowRetire 是否允许把本次目录里消失的文档标记失效；某个子范围读取失败时传 false，
     *                    避免把「没读到」误判成「已删除」。
     */
    public IngestSyncInfo run(String kbId, String sourceId, String sourceType, String scope,
            List<IngestDocRef> refs, Map<String, String> versions, boolean allowRetire,
            DocContentFetcher fetcher, KbCaller caller) {
        Map<String, MaterialBinding> bound = loadBound(kbId, sourceId, caller);
        Map<String, String> versionOf = versions == null
                ? Collections.<String, String>emptyMap() : versions;

        IngestSyncInfo result = new IngestSyncInfo();
        Set<String> alive = new HashSet<>();
        for (IngestDocRef ref : refs) {
            alive.add(ref.getSlug());
            MaterialBinding existing = bound.get(ref.getSlug());
            String version = versionOf.get(ref.getSlug());
            if (existing != null && version != null && version.equals(
                    IngestMetadata.field(existing.getMetadata(), "contentUpdatedAt"))) {
                result.markUnchanged();
                continue;
            }
            syncOne(kbId, sourceId, sourceType, scope, fetcher, ref, existing, result, caller);
        }
        retireMissing(kbId, bound, alive, !refs.isEmpty() && allowRetire, result, caller);
        return result;
    }

    /** 单篇同步：拉正文，按是否已有绑定选择新建或追加版本。 */
    private void syncOne(String kbId, String sourceId, String sourceType, String scope,
            DocContentFetcher fetcher, IngestDocRef ref, MaterialBinding existing,
            IngestSyncInfo result, KbCaller caller) {
        try {
            IngestDocContent content = fetcher.fetch(ref);
            if (content == null || content.getMarkdown() == null
                    || content.getMarkdown().trim().isEmpty()) {
                result.markSkipped();
                return;
            }
            MaterialSyncRequest request = new MaterialSyncRequest();
            request.setKbId(kbId);
            request.setMaterialId(existing == null ? null : existing.getMaterialId());
            request.setCategoryId(ref.getCategoryId());
            request.setTitle(ref.getTitle());
            request.setContent(content.getMarkdown().getBytes(StandardCharsets.UTF_8));
            request.setSourceType(sourceType);
            request.setSourceBindingId(sourceId);
            request.setSourceVersion(content.getVersion());
            request.setMetadata(IngestMetadata.write(sourceType, scopeOf(ref, scope), ref.getSlug(),
                    content.getDocId(), ref.getPath(), ref.getLevel(), content.getVersion()));
            MaterialSyncResult outcome = materialService.syncUpsert(request, caller);
            if (MaterialSyncResult.CREATED.equals(outcome.getStatus())) {
                result.markCreated();
            } else if (MaterialSyncResult.UPDATED.equals(outcome.getStatus())) {
                result.markUpdated();
            } else if (MaterialSyncResult.UNCHANGED.equals(outcome.getStatus())) {
                result.markUnchanged();
            } else if (MaterialSyncResult.DUPLICATE.equals(outcome.getStatus())) {
                result.markSkipped();
            } else {
                result.markFailed("《" + ref.getTitle() + "》" + outcome.getMessage());
            }
        } catch (RuntimeException e) {
            LOG.warn("{} 文档同步失败 doc={} reason={}", sourceType, ref.getSlug(), e.getMessage());
            result.markFailed("《" + ref.getTitle() + "》" + e.getMessage());
        }
    }

    /** 目录里已不存在的文档把物料标记删除；目录为空时不动，避免误删整库。 */
    private void retireMissing(String kbId, Map<String, MaterialBinding> bound, Set<String> alive,
            boolean tocNotEmpty, IngestSyncInfo result, KbCaller caller) {
        if (!tocNotEmpty || bound.isEmpty()) {
            return;
        }
        for (Map.Entry<String, MaterialBinding> entry : bound.entrySet()) {
            if (alive.contains(entry.getKey())) {
                continue;
            }
            MaterialBinding info = entry.getValue();
            List<MaterialBatchItem> items = materialService.remove(kbId,
                    Collections.singletonList(info.getMaterialId()), caller);
            if (!items.isEmpty() && items.get(0).isSuccess()) {
                result.markRetired();
            } else {
                result.markFailed("《" + info.getTitle() + "》失效失败");
            }
        }
    }

    /** 文档所属范围：多库同步时用文档自己的库标识，单库沿用同步范围。 */
    private String scopeOf(IngestDocRef ref, String fallback) {
        return ref.getBookScope() != null && !ref.getBookScope().trim().isEmpty()
                ? ref.getBookScope() : fallback;
    }

    /** 读回该接入源已登记的物料，按 metadata 里的 docSlug 建索引。 */
    private Map<String, MaterialBinding> loadBound(String kbId, String sourceId, KbCaller caller) {
        Map<String, MaterialBinding> bound = new LinkedHashMap<>();
        for (MaterialBinding info : materialService.listBySource(kbId, sourceId, caller)) {
            String slug = IngestMetadata.field(info.getMetadata(), "docSlug");
            if (slug != null && !bound.containsKey(slug)) {
                bound.put(slug, info);
            }
        }
        return bound;
    }

    /** 供应商只需实现「给定节点，拉出正文」；失败抛运行时异常即可，由执行器计数。 */
    public interface DocContentFetcher {

        IngestDocContent fetch(IngestDocRef ref);
    }
}
