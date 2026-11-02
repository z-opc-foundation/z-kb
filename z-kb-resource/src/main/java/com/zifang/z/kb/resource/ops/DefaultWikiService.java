package com.zifang.z.kb.resource.ops;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.compilation.ArtifactStatus;
import com.zifang.z.kb.api.compilation.ArtifactType;
import com.zifang.z.kb.api.compilation.RetrievalState;
import com.zifang.z.kb.api.compilation.TaskRunStatus;
import com.zifang.z.kb.api.material.MaterialCompileSource;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.material.ParsedDraftStatus;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBaseAction;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.wiki.WikiAgentSaveParam;
import com.zifang.z.kb.api.wiki.WikiCompileParam;
import com.zifang.z.kb.api.wiki.WikiCompileTaskView;
import com.zifang.z.kb.api.wiki.WikiGenerateItemView;
import com.zifang.z.kb.api.wiki.WikiGenerateResultView;
import com.zifang.z.kb.api.wiki.WikiGeneratedDocView;
import com.zifang.z.kb.api.wiki.WikiLineageEdgeView;
import com.zifang.z.kb.api.wiki.WikiLineageNodeView;
import com.zifang.z.kb.api.wiki.WikiLineageView;
import com.zifang.z.kb.api.wiki.WikiPageDetailView;
import com.zifang.z.kb.api.wiki.WikiPageView;
import com.zifang.z.kb.api.wiki.WikiPointView;
import com.zifang.z.kb.api.wiki.WikiService;
import com.zifang.z.kb.api.wiki.WikiSourceView;
import com.zifang.z.kb.core.wiki.WikiPageBuilder;
import com.zifang.z.kb.storage.compilation.entity.ArtifactEntity;
import com.zifang.z.kb.storage.compilation.entity.ArtifactVersionEntity;
import com.zifang.z.kb.storage.compilation.mapper.ArtifactMapper;
import com.zifang.z.kb.storage.compilation.mapper.ArtifactVersionMapper;
import com.zifang.z.kb.storage.extraction.entity.GraphEdgeEntity;
import com.zifang.z.kb.storage.extraction.entity.GraphNodeEntity;
import com.zifang.z.kb.storage.extraction.mapper.GraphEdgeMapper;
import com.zifang.z.kb.storage.extraction.mapper.GraphNodeMapper;
import com.zifang.z.kb.storage.wiki.entity.WikiDocEntity;
import com.zifang.z.kb.storage.wiki.entity.WikiPageEntity;
import com.zifang.z.kb.storage.wiki.entity.WikiPageSourceEntity;
import com.zifang.z.kb.storage.wiki.mapper.WikiDocMapper;
import com.zifang.z.kb.storage.wiki.mapper.WikiPageMapper;
import com.zifang.z.kb.storage.wiki.mapper.WikiPageSourceMapper;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Wiki 域默认实现：规则生成按物料版本确定性切分要点，Agent 产物按页面标识幂等落库，
 * 血缘由来源记录与本地规则图谱拼装。
 *
 * <p>z-kb 没有独立任务内核，编译入口在请求内同步完成并返回终态。</p>
 */
public class DefaultWikiService implements WikiService {

    private static final int MAX_MATERIALS = 100;

    private static final int MAX_LIST = 100;

    private static final int DEFAULT_LIST = 50;

    private static final int MAX_AGENT_PAGES = 50;

    private static final int MAX_SLUG_CHARS = 128;

    private static final int MAX_TITLE_CHARS = 255;

    private static final int MAX_GRAPH_ITEMS = 500;

    private static final String STATUS_READY = "READY";

    private static final String STATUS_FAILED = "FAILED";

    private static final String STATUS_DELETED = "DELETED";

    private static final String RELATION_SOURCED_FROM = "SOURCED_FROM";

    private static final String GENERATOR_AGENT = "AGENT";

    private static final String GENERATOR_RULES = "RULES";

    private static final String TASK_TYPE_WIKI_COMPILE = "WIKI_COMPILE";

    private static final String COMPILER_VERSION = "local-wiki-v1";

    private static final String CONFIG_VERSION = "v1";

    private static final String NOTE_GRAPH_RULE = "图谱为本地规则抽取，仅用于召回定位。";

    private final WikiPageMapper pageMapper;

    private final WikiPageSourceMapper sourceMapper;

    private final WikiDocMapper docMapper;

    private final ArtifactMapper artifactMapper;

    private final ArtifactVersionMapper artifactVersionMapper;

    private final MaterialService materialService;

    private final KnowledgeBaseResourceService resourceService;

    private final GraphNodeMapper nodeMapper;

    private final GraphEdgeMapper edgeMapper;

    public DefaultWikiService(WikiPageMapper pageMapper,
                              WikiPageSourceMapper sourceMapper,
                              WikiDocMapper docMapper,
                              ArtifactMapper artifactMapper,
                              ArtifactVersionMapper artifactVersionMapper,
                              MaterialService materialService,
                              KnowledgeBaseResourceService resourceService,
                              GraphNodeMapper nodeMapper,
                              GraphEdgeMapper edgeMapper) {
        this.pageMapper = pageMapper;
        this.sourceMapper = sourceMapper;
        this.docMapper = docMapper;
        this.artifactMapper = artifactMapper;
        this.artifactVersionMapper = artifactVersionMapper;
        this.materialService = materialService;
        this.resourceService = resourceService;
        this.nodeMapper = nodeMapper;
        this.edgeMapper = edgeMapper;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public WikiGenerateResultView generate(String kbId, List<String> materialIds, KbCaller caller) {
        if (!hasText(kbId) || materialIds == null || materialIds.isEmpty()) {
            throw paramInvalid();
        }
        String kb = resourceService.requireActionable(kbId.trim(), KnowledgeBaseAction.MATERIAL_WRITE,
                caller).getKbId();
        LinkedHashSet<String> uniqueIds = new LinkedHashSet<>();
        for (String materialId : materialIds) {
            if (hasText(materialId)) {
                uniqueIds.add(materialId.trim());
            }
        }
        if (uniqueIds.isEmpty() || uniqueIds.size() > MAX_MATERIALS) {
            throw paramInvalid();
        }

        List<WikiGenerateItemView> items = new ArrayList<>();
        int success = 0;
        for (String materialId : uniqueIds) {
            WikiGenerateItemView item = new WikiGenerateItemView();
            item.setMaterialId(materialId);
            try {
                MaterialCompileSource source = materialService.loadCompileSource(materialId, null,
                        caller);
                if (!kb.equals(source.getKbId())) {
                    throw paramInvalid();
                }
                generateOne(source, caller, item);
                item.setStatus(STATUS_READY);
                success++;
            } catch (KBException e) {
                item.setStatus(STATUS_FAILED);
                item.setFailureSummary(e.getMessage());
            } catch (RuntimeException e) {
                item.setStatus(STATUS_FAILED);
                item.setFailureSummary(e.getMessage() == null ? "Wiki 生成失败" : e.getMessage());
            }
            items.add(item);
        }

        WikiGenerateResultView result = new WikiGenerateResultView();
        result.setTotalCount(items.size());
        result.setSuccessCount(success);
        result.setFailedCount(items.size() - success);
        result.setItems(items);
        return result;
    }

    /** 从物料编译源切分要点并生成单个 Wiki：无页面则新建，内容哈希变化则升版本更新，最后刷新来源记录。 */
    private WikiPageEntity generateOne(MaterialCompileSource source, KbCaller caller,
                                       WikiGenerateItemView item) {
        if (!ParsedDraftStatus.READY.name().equals(source.getDraftStatus())
                || !hasText(source.getTextContent())) {
            throw new KBException("WIKI_SOURCE_NOT_READY", "物料尚未解析成功，不能生成 Wiki");
        }
        String tenant = caller.getTenantCode();
        String title = WikiPageBuilder.stripExtension(source.getTitle());
        List<WikiPointView> points = WikiPageBuilder.splitPoints(source.getTextContent(), title);
        String content = WikiPageBuilder.buildContent(points);
        String hash = WikiPageBuilder.sha256(source.getVersionId() + "|" + content);
        String artifactId = upsertArtifact(tenant, source.getKbId(), source.getMaterialId(),
                source.getVersionId(), source.getTitle() + " · Wiki", content, caller);

        WikiPageEntity page = findRulePage(tenant, source.getMaterialId());
        Instant now = Instant.now();
        if (page == null) {
            page = new WikiPageEntity();
            page.setId(UUID.randomUUID().toString());
            page.setWikiId(UUID.randomUUID().toString());
            page.setTenantCode(tenant);
            page.setKbId(source.getKbId());
            page.setMaterialId(source.getMaterialId());
            page.setMaterialVersionId(source.getVersionId());
            page.setArtifactId(artifactId);
            page.setTitle(WikiPageBuilder.truncate(title, MAX_TITLE_CHARS));
            page.setSummary(WikiPageBuilder.summaryOf(points, title));
            page.setContent(content);
            page.setSourceChunkIds("");
            page.setGenerator(GENERATOR_RULES);
            page.setPointCount(points.size());
            page.setCharCount(WikiPageBuilder.charCount(points));
            page.setVersionNo(1);
            page.setSourceHash(hash);
            page.setStatus(STATUS_READY);
            page.setIsDeleted(0);
            page.setCreateBy(caller.getActorId());
            page.setUpdateBy(caller.getActorId());
            page.setCreateTime(now);
            page.setUpdateTime(now);
            pageMapper.insert(page);
        } else if (!hash.equals(page.getSourceHash())) {
            page.setMaterialVersionId(source.getVersionId());
            page.setArtifactId(artifactId);
            page.setTitle(WikiPageBuilder.truncate(title, MAX_TITLE_CHARS));
            page.setSummary(WikiPageBuilder.summaryOf(points, title));
            page.setContent(content);
            page.setGenerator(GENERATOR_RULES);
            page.setPointCount(points.size());
            page.setCharCount(WikiPageBuilder.charCount(points));
            page.setVersionNo(page.getVersionNo() == null ? 1 : page.getVersionNo() + 1);
            page.setSourceHash(hash);
            page.setStatus(STATUS_READY);
            page.setUpdateBy(caller.getActorId());
            page.setUpdateTime(now);
            pageMapper.updateById(page);
        }

        upsertSource(tenant, page.getWikiId(), source, caller, now);
        item.setWikiId(page.getWikiId());
        item.setTitle(page.getTitle());
        item.setVersionNo(page.getVersionNo());
        return page;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public WikiGeneratedDocView saveGenerated(WikiAgentSaveParam param, KbCaller caller) {
        if (param == null || !hasText(param.getKbId()) || !hasText(param.getMaterialId())
                || param.getPages().isEmpty() || param.getPages().size() > MAX_AGENT_PAGES) {
            throw paramInvalid();
        }
        String tenant = caller.getTenantCode();
        String kbId = param.getKbId().trim();
        String materialId = param.getMaterialId().trim();
        String kb = resourceService.requireActionable(kbId, KnowledgeBaseAction.MATERIAL_WRITE,
                caller).getKbId();
        MaterialCompileSource source = materialService.loadCompileSource(materialId,
                hasText(param.getMaterialVersionId()) ? param.getMaterialVersionId().trim() : null,
                caller);
        if (!kb.equals(source.getKbId())) {
            throw paramInvalid();
        }
        String versionId = hasText(param.getMaterialVersionId())
                ? param.getMaterialVersionId().trim() : source.getVersionId();
        String generator = GENERATOR_RULES.equalsIgnoreCase(
                param.getGenerator() == null ? "" : param.getGenerator().trim())
                ? GENERATOR_RULES : GENERATOR_AGENT;

        LinkedHashMap<String, WikiAgentSaveParam.Page> unique = new LinkedHashMap<>();
        for (WikiAgentSaveParam.Page page : param.getPages()) {
            String slug = page.getSlug() == null ? null : page.getSlug().trim();
            if (!hasText(slug) || slug.length() > MAX_SLUG_CHARS
                    || !hasText(page.getContent()) || unique.containsKey(slug)) {
                continue;
            }
            page.setSlug(slug);
            unique.put(slug, page);
        }
        if (unique.isEmpty()) {
            throw paramInvalid();
        }

        Instant now = Instant.now();
        StringBuilder artifactContent = new StringBuilder();
        for (WikiAgentSaveParam.Page page : unique.values()) {
            artifactContent.append(page.getSlug()).append('|').append(page.getContent()).append('\n');
        }
        String artifactId = upsertArtifact(tenant, kb, materialId, versionId,
                source.getTitle() + " · Wiki", artifactContent.toString(), caller);
        LinkedHashMap<String, WikiPageEntity> existing = new LinkedHashMap<>();
        for (WikiPageEntity row : listSlugPages(tenant, materialId)) {
            existing.put(row.getPageSlug(), row);
        }

        List<WikiGeneratedDocView.Page> pages = new ArrayList<>();
        List<String> allChunkIds = new ArrayList<>();
        for (WikiAgentSaveParam.Page page : unique.values()) {
            String content = page.getContent().trim();
            String hash = WikiPageBuilder.sha256(versionId + "|" + content);
            String summary = hasText(page.getSummary())
                    ? WikiPageBuilder.truncate(page.getSummary().trim(),
                    WikiPageBuilder.MAX_SUMMARY_CHARS)
                    : WikiPageBuilder.summaryFromContent(content);
            String chunkIds = WikiPageBuilder.joinChunkIds(page.getChunkIds());
            WikiPageEntity row = existing.remove(page.getSlug());
            if (row == null) {
                row = new WikiPageEntity();
                row.setId(UUID.randomUUID().toString());
                row.setWikiId(UUID.randomUUID().toString());
                row.setTenantCode(tenant);
                row.setKbId(kb);
                row.setMaterialId(materialId);
                row.setMaterialVersionId(versionId);
                row.setArtifactId(artifactId);
                row.setPageSlug(page.getSlug());
                row.setTitle(WikiPageBuilder.truncate(titleOf(page, page.getSlug()),
                        MAX_TITLE_CHARS));
                row.setSummary(summary);
                row.setContent(content);
                row.setSourceChunkIds(chunkIds);
                row.setGenerator(generator);
                row.setPointCount(WikiPageBuilder.pointCount(page.getChunkIds()));
                row.setCharCount(content.length());
                row.setVersionNo(1);
                row.setSourceHash(hash);
                row.setStatus(STATUS_READY);
                row.setIsDeleted(0);
                row.setCreateBy(caller.getActorId());
                row.setUpdateBy(caller.getActorId());
                row.setCreateTime(now);
                row.setUpdateTime(now);
                pageMapper.insert(row);
            } else if (!hash.equals(row.getSourceHash())) {
                row.setMaterialVersionId(versionId);
                row.setArtifactId(artifactId);
                row.setTitle(WikiPageBuilder.truncate(titleOf(page, page.getSlug()),
                        MAX_TITLE_CHARS));
                row.setSummary(summary);
                row.setContent(content);
                row.setSourceChunkIds(chunkIds);
                row.setGenerator(generator);
                row.setPointCount(WikiPageBuilder.pointCount(page.getChunkIds()));
                row.setCharCount(content.length());
                row.setVersionNo(row.getVersionNo() == null ? 1 : row.getVersionNo() + 1);
                row.setSourceHash(hash);
                row.setStatus(STATUS_READY);
                row.setUpdateBy(caller.getActorId());
                row.setUpdateTime(now);
                pageMapper.updateById(row);
            } else {
                row.setMaterialVersionId(versionId);
                row.setArtifactId(artifactId);
                row.setSourceChunkIds(chunkIds);
                row.setUpdateBy(caller.getActorId());
                row.setUpdateTime(now);
                pageMapper.updateById(row);
            }
            upsertSource(tenant, row.getWikiId(), source, caller, now);
            WikiGeneratedDocView.Page info = new WikiGeneratedDocView.Page();
            info.setWikiId(row.getWikiId());
            info.setSlug(row.getPageSlug());
            info.setTitle(row.getTitle());
            info.setSummary(row.getSummary());
            info.setCharCount(row.getCharCount());
            info.setVersionNo(row.getVersionNo());
            info.setChunkIds(WikiPageBuilder.splitChunkIds(chunkIds));
            pages.add(info);
            allChunkIds.addAll(info.getChunkIds());
        }
        for (WikiPageEntity stale : existing.values()) {
            pageMapper.deleteById(stale.getId());
        }

        LinkedHashSet<String> distinctChunks = new LinkedHashSet<>(allChunkIds);
        int chunkCount = param.getChunkCount() == null || param.getChunkCount() < 0
                ? distinctChunks.size() : param.getChunkCount();
        String indexMd = param.getIndexMd() == null ? "" : param.getIndexMd().trim();
        String docHash = WikiPageBuilder.sha256(versionId + "|" + indexMd + "|"
                + unique.keySet());

        WikiDocEntity doc = findDoc(tenant, materialId, versionId);
        if (doc == null) {
            doc = new WikiDocEntity();
            doc.setId(UUID.randomUUID().toString());
            doc.setTenantCode(tenant);
            doc.setKbId(kb);
            doc.setMaterialId(materialId);
            doc.setMaterialVersionId(versionId);
            doc.setIndexMd(indexMd);
            doc.setPageCount(pages.size());
            doc.setChunkCount(chunkCount);
            doc.setCoveredChunkCount(distinctChunks.size());
            doc.setGenerator(generator);
            doc.setVersionNo(1);
            doc.setSourceHash(docHash);
            doc.setIsDeleted(0);
            doc.setCreateBy(caller.getActorId());
            doc.setUpdateBy(caller.getActorId());
            doc.setCreateTime(now);
            doc.setUpdateTime(now);
            docMapper.insert(doc);
        } else {
            boolean changed = !docHash.equals(doc.getSourceHash());
            doc.setIndexMd(indexMd);
            doc.setPageCount(pages.size());
            doc.setChunkCount(chunkCount);
            doc.setCoveredChunkCount(distinctChunks.size());
            doc.setGenerator(generator);
            doc.setVersionNo(changed
                    ? (doc.getVersionNo() == null ? 1 : doc.getVersionNo() + 1)
                    : doc.getVersionNo());
            doc.setSourceHash(docHash);
            doc.setUpdateBy(caller.getActorId());
            doc.setUpdateTime(now);
            docMapper.updateById(doc);
        }

        WikiGeneratedDocView result = new WikiGeneratedDocView();
        result.setMaterialId(materialId);
        result.setMaterialVersionId(versionId);
        result.setIndexMd(indexMd);
        result.setPageCount(pages.size());
        result.setChunkCount(chunkCount);
        result.setCoveredChunkCount(distinctChunks.size());
        result.setVersionNo(doc.getVersionNo());
        result.setGenerator(generator);
        result.setPages(pages);
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public WikiCompileTaskView compile(WikiCompileParam param, KbCaller caller) {
        if (param == null || !hasText(param.getKbId()) || !hasText(param.getMaterialId())) {
            throw paramInvalid();
        }
        String kbId = param.getKbId().trim();
        String materialId = param.getMaterialId().trim();
        String kb = resourceService.requireActionable(kbId, KnowledgeBaseAction.MATERIAL_WRITE,
                caller).getKbId();
        MaterialCompileSource source = materialService.loadCompileSource(materialId,
                hasText(param.getVersionId()) ? param.getVersionId().trim() : null, caller);
        if (!kb.equals(source.getKbId())) {
            throw paramInvalid();
        }
        String versionId = hasText(param.getVersionId())
                ? param.getVersionId().trim() : source.getVersionId();
        WikiGenerateItemView item = new WikiGenerateItemView();
        item.setMaterialId(materialId);
        generateOne(source, caller, item);

        WikiCompileTaskView view = new WikiCompileTaskView();
        view.setTaskId(item.getWikiId());
        view.setTaskType(TASK_TYPE_WIKI_COMPILE);
        view.setStatus(TaskRunStatus.SUCCEEDED.name());
        view.setBizKey(versionId);
        view.setBizId(materialId);
        return view;
    }

    @Override
    public WikiGeneratedDocView queryGenerated(String materialId, KbCaller caller) {
        if (!hasText(materialId)) {
            throw new KBException("MATERIAL_PARAM_INVALID", "物料参数不合法");
        }
        String tenant = caller.getTenantCode();
        String trimmed = materialId.trim();
        MaterialCompileSource source = materialService.loadCompileSource(trimmed, null, caller);
        resourceService.requireReadable(source.getKbId(), caller);
        WikiDocEntity doc = latestDoc(tenant, trimmed);
        if (doc == null) {
            return null;
        }
        WikiGeneratedDocView result = new WikiGeneratedDocView();
        result.setMaterialId(trimmed);
        result.setMaterialVersionId(doc.getMaterialVersionId());
        result.setIndexMd(doc.getIndexMd());
        result.setPageCount(doc.getPageCount());
        result.setChunkCount(doc.getChunkCount());
        result.setCoveredChunkCount(doc.getCoveredChunkCount());
        result.setVersionNo(doc.getVersionNo());
        result.setGenerator(doc.getGenerator());
        for (WikiPageEntity row : listSlugPages(tenant, trimmed)) {
            WikiGeneratedDocView.Page page = new WikiGeneratedDocView.Page();
            page.setWikiId(row.getWikiId());
            page.setSlug(row.getPageSlug());
            page.setTitle(row.getTitle());
            page.setSummary(row.getSummary());
            page.setCharCount(row.getCharCount());
            page.setVersionNo(row.getVersionNo());
            page.setChunkIds(WikiPageBuilder.splitChunkIds(row.getSourceChunkIds()));
            result.getPages().add(page);
        }
        return result;
    }

    @Override
    public List<WikiPageView> list(String kbId, String keyword, int limit, KbCaller caller) {
        if (!hasText(kbId)) {
            throw new KBException("KB_PARAM_INVALID", "知识库参数不合法");
        }
        String kb = resourceService.requireReadable(kbId.trim(), caller).getKbId();
        String tenant = caller.getTenantCode();
        int size = limit <= 0 ? DEFAULT_LIST : Math.min(limit, MAX_LIST);
        QueryWrapper<WikiPageEntity> query = new QueryWrapper<WikiPageEntity>()
                .eq("tenant_code", tenant)
                .eq("kb_id", kb)
                .eq("is_deleted", 0)
                .ne("status", STATUS_DELETED)
                .orderByDesc("update_time")
                .orderByDesc("id")
                .last("LIMIT " + size);
        if (hasText(keyword)) {
            String trimmed = keyword.trim();
            query.and(wrapper -> wrapper.like("title", trimmed).or().like("summary", trimmed));
        }
        List<WikiPageView> result = new ArrayList<>();
        for (WikiPageEntity page : pageMapper.selectList(query)) {
            result.add(toPageView(tenant, page));
        }
        return result;
    }

    @Override
    public WikiPageDetailView detail(String wikiId, KbCaller caller) {
        String tenant = caller.getTenantCode();
        WikiPageEntity page = requirePage(tenant, wikiId);
        resourceService.requireReadable(page.getKbId(), caller);
        List<WikiSourceView> sources = loadSources(tenant, page.getWikiId());

        WikiPageDetailView detail = new WikiPageDetailView();
        WikiPageView pageView = toPageView(tenant, page);
        pageView.setSourceCount(sources.size());
        detail.setPage(pageView);
        detail.setPoints(WikiPageBuilder.parsePoints(page.getContent()));
        detail.setSources(sources);
        detail.setGraphNodeCount(toInt(countGraphNodes(tenant, materialIds(sources))));
        detail.setNote(NOTE_GRAPH_RULE);
        return detail;
    }

    @Override
    public List<WikiPageView> listByMaterial(String materialId, KbCaller caller) {
        if (!hasText(materialId)) {
            throw new KBException("MATERIAL_PARAM_INVALID", "物料参数不合法");
        }
        String tenant = caller.getTenantCode();
        QueryWrapper<WikiPageEntity> query = new QueryWrapper<WikiPageEntity>()
                .eq("tenant_code", tenant)
                .eq("material_id", materialId.trim())
                .eq("is_deleted", 0)
                .orderByAsc("id");
        List<WikiPageEntity> pages = pageMapper.selectList(query);
        List<WikiPageView> result = new ArrayList<>();
        if (pages.isEmpty()) {
            return result;
        }
        resourceService.requireReadable(pages.get(0).getKbId(), caller);
        for (WikiPageEntity page : pages) {
            result.add(toPageView(tenant, page));
        }
        return result;
    }

    @Override
    public WikiLineageView lineage(String kbId, String wikiId, KbCaller caller) {
        String tenant = caller.getTenantCode();
        List<WikiPageEntity> pages = new ArrayList<>();
        WikiLineageView info = new WikiLineageView();
        if (hasText(wikiId)) {
            WikiPageEntity page = requirePage(tenant, wikiId);
            resourceService.requireReadable(page.getKbId(), caller);
            pages.add(page);
            info.setWikiId(page.getWikiId());
            info.setTitle(page.getTitle());
        } else {
            if (!hasText(kbId)) {
                throw paramInvalid();
            }
            String kb = resourceService.requireReadable(kbId.trim(), caller).getKbId();
            pages.addAll(listAllPages(tenant, kb));
            info.setTitle("库内 Wiki 血缘");
        }

        Map<String, WikiLineageNodeView> nodes = new LinkedHashMap<>();
        List<WikiLineageEdgeView> edges = new ArrayList<>();
        LinkedHashSet<String> materialIds = new LinkedHashSet<>();
        int sourceCount = 0;
        for (WikiPageEntity page : pages) {
            String wikiNodeId = "wiki:" + page.getWikiId();
            nodes.put(wikiNodeId, new WikiLineageNodeView(wikiNodeId, "WIKI", page.getTitle(),
                    page.getWikiId()));
            for (WikiSourceView source : loadSources(tenant, page.getWikiId())) {
                String materialNodeId = "material:" + source.getMaterialId();
                nodes.put(materialNodeId, new WikiLineageNodeView(materialNodeId, "MATERIAL",
                        source.getMaterialTitle(), source.getMaterialId()));
                edges.add(new WikiLineageEdgeView(materialNodeId, wikiNodeId,
                        RELATION_SOURCED_FROM));
                materialIds.add(source.getMaterialId());
                sourceCount++;
            }
        }

        List<String> materialIdList = new ArrayList<>(materialIds);
        long graphNodeCount = countGraphNodes(tenant, materialIdList);
        if (!materialIdList.isEmpty()) {
            QueryWrapper<GraphNodeEntity> nodeQuery = new QueryWrapper<GraphNodeEntity>()
                    .eq("tenant_code", tenant)
                    .in("material_id", materialIdList)
                    .eq("is_deleted", 0)
                    .orderByAsc("node_id")
                    .last("LIMIT " + MAX_GRAPH_ITEMS);
            for (GraphNodeEntity node : nodeMapper.selectList(nodeQuery)) {
                nodes.put(node.getNodeId(), new WikiLineageNodeView(node.getNodeId(),
                        node.getNodeType(), node.getName(), node.getMaterialId()));
            }
            QueryWrapper<GraphEdgeEntity> edgeQuery = new QueryWrapper<GraphEdgeEntity>()
                    .eq("tenant_code", tenant)
                    .in("material_id", materialIdList)
                    .eq("is_deleted", 0)
                    .orderByAsc("edge_id")
                    .last("LIMIT " + MAX_GRAPH_ITEMS);
            for (GraphEdgeEntity edge : edgeMapper.selectList(edgeQuery)) {
                edges.add(new WikiLineageEdgeView(edge.getSourceNodeId(), edge.getTargetNodeId(),
                        edge.getEdgeType()));
            }
        }

        List<String> relationTypes = new ArrayList<>();
        relationTypes.add(RELATION_SOURCED_FROM);
        for (WikiLineageEdgeView edge : edges) {
            if (!relationTypes.contains(edge.getRelation())) {
                relationTypes.add(edge.getRelation());
            }
        }
        info.setNodes(new ArrayList<>(nodes.values()));
        info.setEdges(edges);
        info.setRelationTypes(relationTypes);
        info.setSourceCount(sourceCount);
        info.setGraphNodeCount(toInt(graphNodeCount));
        info.setNote(NOTE_GRAPH_RULE);
        return info;
    }

    /** 登记或刷新 WIKI_DOC 产物：内容变化追加产物版本，供追溯。 */
    private String upsertArtifact(String tenant, String kbId, String materialId, String versionId,
                                  String title, String content, KbCaller caller) {
        Instant now = Instant.now();
        ArtifactEntity artifact = artifactMapper.selectOne(new QueryWrapper<ArtifactEntity>()
                .eq("tenant_code", tenant)
                .eq("material_version_id", versionId)
                .eq("artifact_type", ArtifactType.WIKI_DOC.name())
                .eq("is_deleted", 0)
                .orderByAsc("create_time")
                .last("LIMIT 1"));
        String artifactVersionId = UUID.randomUUID().toString();
        if (artifact == null) {
            artifact = new ArtifactEntity();
            artifact.setId(UUID.randomUUID().toString());
            artifact.setArtifactId(UUID.randomUUID().toString());
            artifact.setTenantCode(tenant);
            artifact.setKbId(kbId);
            artifact.setMaterialId(materialId);
            artifact.setMaterialVersionId(versionId);
            artifact.setArtifactType(ArtifactType.WIKI_DOC.name());
            artifact.setTitle(WikiPageBuilder.truncate(title, MAX_TITLE_CHARS));
            artifact.setLifecycleStatus(ArtifactStatus.PUBLISHED.name());
            artifact.setRetrievalState(RetrievalState.NOT_INDEXED.name());
            artifact.setCurrentVersionId(artifactVersionId);
            artifact.setEvidenceRef("material_version:" + versionId);
            artifact.setCreatedBy(caller.getActorId());
            artifact.setPublishedAt(now);
            artifact.setIsDeleted(0);
            artifact.setCreateBy(caller.getActorId());
            artifact.setUpdateBy(caller.getActorId());
            artifact.setCreateTime(now);
            artifact.setUpdateTime(now);
            artifactMapper.insert(artifact);
        } else {
            artifact.setTitle(WikiPageBuilder.truncate(title, MAX_TITLE_CHARS));
            artifact.setCurrentVersionId(artifactVersionId);
            artifact.setEvidenceRef("material_version:" + versionId);
            artifact.setUpdateBy(caller.getActorId());
            artifact.setUpdateTime(now);
            artifactMapper.updateById(artifact);
        }

        String contentHash = WikiPageBuilder.sha256(content);
        ArtifactVersionEntity latest = artifactVersionMapper.selectOne(
                new QueryWrapper<ArtifactVersionEntity>()
                        .eq("tenant_code", tenant)
                        .eq("artifact_id", artifact.getArtifactId())
                        .eq("is_deleted", 0)
                        .orderByDesc("version_no")
                        .last("LIMIT 1"));
        if (latest == null || !contentHash.equals(latest.getContentHash())) {
            ArtifactVersionEntity version = new ArtifactVersionEntity();
            version.setId(UUID.randomUUID().toString());
            version.setArtifactVersionId(artifactVersionId);
            version.setTenantCode(tenant);
            version.setArtifactId(artifact.getArtifactId());
            version.setVersionNo(latest == null || latest.getVersionNo() == null
                    ? 1 : latest.getVersionNo() + 1);
            version.setContentHash(contentHash);
            version.setStorageRef("wiki-page-set:" + artifactVersionId);
            version.setCompilerVersion(COMPILER_VERSION);
            version.setConfigVersion(CONFIG_VERSION);
            version.setIsDeleted(0);
            version.setCreateBy(caller.getActorId());
            version.setUpdateBy(caller.getActorId());
            version.setCreateTime(now);
            version.setUpdateTime(now);
            artifactVersionMapper.insert(version);
        }
        return artifact.getArtifactId();
    }

    /** 按物料 ID 新增或更新 Wiki 来源记录，记录物料版本与来源版本号。 */
    private void upsertSource(String tenant, String wikiId, MaterialCompileSource source,
                              KbCaller caller, Instant now) {
        WikiPageSourceEntity existing = sourceMapper.selectOne(
                new QueryWrapper<WikiPageSourceEntity>()
                        .eq("tenant_code", tenant)
                        .eq("wiki_id", wikiId)
                        .eq("material_id", source.getMaterialId())
                        .eq("is_deleted", 0)
                        .last("LIMIT 1"));
        if (existing == null) {
            WikiPageSourceEntity row = new WikiPageSourceEntity();
            row.setId(UUID.randomUUID().toString());
            row.setTenantCode(tenant);
            row.setWikiId(wikiId);
            row.setMaterialId(source.getMaterialId());
            row.setMaterialVersionId(source.getVersionId());
            row.setMaterialTitle(source.getTitle());
            row.setSourceVersionNo(source.getVersionNo() == null ? 1 : source.getVersionNo());
            row.setIsDeleted(0);
            row.setCreateBy(caller.getActorId());
            row.setUpdateBy(caller.getActorId());
            row.setCreateTime(now);
            row.setUpdateTime(now);
            sourceMapper.insert(row);
            return;
        }
        existing.setMaterialVersionId(source.getVersionId());
        existing.setMaterialTitle(source.getTitle());
        existing.setSourceVersionNo(source.getVersionNo() == null ? 1 : source.getVersionNo());
        existing.setUpdateBy(caller.getActorId());
        existing.setUpdateTime(now);
        sourceMapper.updateById(existing);
    }

    private WikiPageEntity findRulePage(String tenant, String materialId) {
        return pageMapper.selectOne(new QueryWrapper<WikiPageEntity>()
                .eq("tenant_code", tenant)
                .eq("material_id", materialId)
                .eq("is_deleted", 0)
                .isNull("page_slug")
                .orderByDesc("update_time")
                .orderByDesc("id")
                .last("LIMIT 1"));
    }

    private List<WikiPageEntity> listSlugPages(String tenant, String materialId) {
        return pageMapper.selectList(new QueryWrapper<WikiPageEntity>()
                .eq("tenant_code", tenant)
                .eq("material_id", materialId)
                .eq("is_deleted", 0)
                .isNotNull("page_slug")
                .orderByAsc("id"));
    }

    private List<WikiPageEntity> listAllPages(String tenant, String kbId) {
        return pageMapper.selectList(new QueryWrapper<WikiPageEntity>()
                .eq("tenant_code", tenant)
                .eq("kb_id", kbId)
                .eq("is_deleted", 0)
                .ne("status", STATUS_DELETED)
                .orderByAsc("id"));
    }

    private WikiDocEntity findDoc(String tenant, String materialId, String versionId) {
        return docMapper.selectOne(new QueryWrapper<WikiDocEntity>()
                .eq("tenant_code", tenant)
                .eq("material_id", materialId)
                .eq("material_version_id", versionId)
                .eq("is_deleted", 0)
                .last("LIMIT 1"));
    }

    private WikiDocEntity latestDoc(String tenant, String materialId) {
        return docMapper.selectOne(new QueryWrapper<WikiDocEntity>()
                .eq("tenant_code", tenant)
                .eq("material_id", materialId)
                .eq("is_deleted", 0)
                .orderByDesc("update_time")
                .orderByDesc("id")
                .last("LIMIT 1"));
    }

    private WikiPageEntity requirePage(String tenant, String wikiId) {
        if (!hasText(wikiId)) {
            throw paramInvalid();
        }
        WikiPageEntity page = pageMapper.selectOne(new QueryWrapper<WikiPageEntity>()
                .eq("tenant_code", tenant)
                .eq("wiki_id", wikiId.trim())
                .eq("is_deleted", 0)
                .last("LIMIT 1"));
        if (page == null || STATUS_DELETED.equals(page.getStatus())) {
            throw new KBException("WIKI_PAGE_NOT_FOUND", "Wiki 页面不存在");
        }
        return page;
    }

    private WikiPageView toPageView(String tenant, WikiPageEntity page) {
        WikiPageView view = new WikiPageView();
        view.setWikiId(page.getWikiId());
        view.setKbId(page.getKbId());
        view.setMaterialId(page.getMaterialId());
        view.setMaterialVersionId(page.getMaterialVersionId());
        view.setTitle(page.getTitle());
        view.setSummary(page.getSummary());
        view.setPointCount(page.getPointCount() == null ? 0 : page.getPointCount());
        view.setCharCount(page.getCharCount() == null ? 0 : page.getCharCount());
        view.setVersionNo(page.getVersionNo() == null ? 1 : page.getVersionNo());
        view.setStatus(page.getStatus());
        view.setUpdateTime(page.getUpdateTime());
        view.setSourceCount(countSources(tenant, page.getWikiId()));
        return view;
    }

    private List<WikiSourceView> loadSources(String tenant, String wikiId) {
        List<WikiSourceView> result = new ArrayList<>();
        for (WikiPageSourceEntity row : sourceMapper.selectList(
                new QueryWrapper<WikiPageSourceEntity>()
                        .eq("tenant_code", tenant)
                        .eq("wiki_id", wikiId)
                        .eq("is_deleted", 0)
                        .orderByAsc("id"))) {
            WikiSourceView info = new WikiSourceView();
            info.setMaterialId(row.getMaterialId());
            info.setMaterialVersionId(row.getMaterialVersionId());
            info.setMaterialTitle(row.getMaterialTitle());
            info.setSourceVersionNo(row.getSourceVersionNo());
            result.add(info);
        }
        return result;
    }

    private int countSources(String tenant, String wikiId) {
        Long count = sourceMapper.selectCount(new QueryWrapper<WikiPageSourceEntity>()
                .eq("tenant_code", tenant)
                .eq("wiki_id", wikiId)
                .eq("is_deleted", 0));
        return toInt(count == null ? 0L : count);
    }

    private long countGraphNodes(String tenant, List<String> materialIds) {
        if (materialIds == null || materialIds.isEmpty()) {
            return 0L;
        }
        Long count = nodeMapper.selectCount(new QueryWrapper<GraphNodeEntity>()
                .eq("tenant_code", tenant)
                .in("material_id", materialIds)
                .eq("is_deleted", 0));
        return count == null ? 0L : count;
    }

    private static List<String> materialIds(List<WikiSourceView> sources) {
        Set<String> ids = new LinkedHashSet<>();
        for (WikiSourceView source : sources) {
            ids.add(source.getMaterialId());
        }
        return new ArrayList<>(ids);
    }

    private static String titleOf(WikiAgentSaveParam.Page page, String slug) {
        return hasText(page.getTitle()) ? page.getTitle().trim() : slug;
    }

    private static int toInt(long value) {
        return value > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) value;
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private static KBException paramInvalid() {
        return new KBException("WIKI_PARAM_INVALID", "Wiki 参数不合法");
    }
}
