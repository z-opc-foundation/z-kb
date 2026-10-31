package com.zifang.z.***REMOVED***.resource.material;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.zifang.z.***REMOVED***.api.***REMOVED***Exception;
import com.zifang.z.***REMOVED***.api.material.***REMOVED***MaterialParser;
import com.zifang.z.***REMOVED***.api.material.***REMOVED***OriginalFileStore;
import com.zifang.z.***REMOVED***.api.material.***REMOVED***ParsedText;
import com.zifang.z.***REMOVED***.api.material.MaterialAttachment;
import com.zifang.z.***REMOVED***.api.material.MaterialBatchItem;
import com.zifang.z.***REMOVED***.api.material.MaterialBinding;
import com.zifang.z.***REMOVED***.api.material.MaterialCompileSource;
import com.zifang.z.***REMOVED***.api.material.MaterialDetail;
import com.zifang.z.***REMOVED***.api.material.MaterialDownload;
import com.zifang.z.***REMOVED***.api.material.MaterialEntryType;
import com.zifang.z.***REMOVED***.api.material.MaterialQuery;
import com.zifang.z.***REMOVED***.api.material.MaterialRepoRef;
import com.zifang.z.***REMOVED***.api.material.MaterialService;
import com.zifang.z.***REMOVED***.api.material.MaterialStatus;
import com.zifang.z.***REMOVED***.api.material.MaterialSyncRequest;
import com.zifang.z.***REMOVED***.api.material.MaterialSyncResult;
import com.zifang.z.***REMOVED***.api.material.MaterialType;
import com.zifang.z.***REMOVED***.api.material.MaterialUploadFile;
import com.zifang.z.***REMOVED***.api.material.MaterialUploadItem;
import com.zifang.z.***REMOVED***.api.material.MaterialVersionStatus;
import com.zifang.z.***REMOVED***.api.material.MaterialVersionView;
import com.zifang.z.***REMOVED***.api.material.MaterialView;
import com.zifang.z.***REMOVED***.api.material.ParsedDraftStatus;
import com.zifang.z.***REMOVED***.api.material.ParsedDraftView;
import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseAction;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseStatus;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseView;
import com.zifang.z.***REMOVED***.api.resource.PageResult;
import com.zifang.z.***REMOVED***.storage.material.entity.MaterialCategoryEntity;
import com.zifang.z.***REMOVED***.storage.material.entity.MaterialEntity;
import com.zifang.z.***REMOVED***.storage.material.entity.MaterialVersionEntity;
import com.zifang.z.***REMOVED***.storage.material.entity.ParsedDraftEntity;
import com.zifang.z.***REMOVED***.storage.material.mapper.MaterialCategoryMapper;
import com.zifang.z.***REMOVED***.storage.material.mapper.MaterialMapper;
import com.zifang.z.***REMOVED***.storage.material.mapper.MaterialVersionMapper;
import com.zifang.z.***REMOVED***.storage.material.mapper.ParsedDraftMapper;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 物料登记与查询默认实现。
 *
 * <p>本实现对 z-***REMOVED*** 已有的存储边界做两点取舍：</p>
 * <ul>
 *   <li>解析在登记事务内同步执行（z-***REMOVED*** 没有任务内核），返回的是真实解析状态而非「已排队」；</li>
 *   <li>原始文件走 {@link ***REMOVED***OriginalFileStore} SPI，默认落本地文件系统。</li>
 * </ul>
 */
public class DefaultMaterialService implements MaterialService {

    private static final long MAX_FILE_SIZE = 100L * 1024 * 1024;
    private static final int MAX_TITLE_LENGTH = 255;
    private static final int MAX_BATCH_SIZE = 200;
    private static final int MAX_TEXT_PREVIEW = 200_000;
    private static final long DEFAULT_PAGE_SIZE = 10;
    private static final long MAX_PAGE_SIZE = 100;
    private static final int MAX_DRAFT_TEXT_LENGTH = 1_000_000;
    private static final int MAX_RECENT_LIMIT = 50;
    private static final int MAX_FILENAME_BASE = 100;
    private static final String MANUAL_PARSER_NAME = "manual-edit";
    private static final String MANUAL_PARSER_VERSION = "1.0";
    private static final String COMPILE_STATUS_NOT_COMPILED = "NOT_COMPILED";
    private static final String GOVERNANCE_STATUS_NONE = "NONE";
    private static final String SOURCE_LOCAL = "LOCAL";

    private final MaterialMapper materialMapper;
    private final MaterialVersionMapper versionMapper;
    private final ParsedDraftMapper draftMapper;
    private final MaterialCategoryMapper categoryMapper;
    private final KnowledgeBaseResourceService resourceService;
    private final ***REMOVED***OriginalFileStore fileStore;
    private final List<***REMOVED***MaterialParser> parsers;

    public DefaultMaterialService(MaterialMapper materialMapper,
                                  MaterialVersionMapper versionMapper,
                                  ParsedDraftMapper draftMapper,
                                  MaterialCategoryMapper categoryMapper,
                                  KnowledgeBaseResourceService resourceService,
                                  ***REMOVED***OriginalFileStore fileStore,
                                  List<***REMOVED***MaterialParser> parsers) {
        this.materialMapper = materialMapper;
        this.versionMapper = versionMapper;
        this.draftMapper = draftMapper;
        this.categoryMapper = categoryMapper;
        this.resourceService = resourceService;
        this.fileStore = fileStore;
        this.parsers = parsers == null ? Collections.emptyList() : parsers;
    }

    @Override
    public PageResult<MaterialView> page(String ***REMOVED***Id, MaterialQuery query, ***REMOVED***Caller caller) {
        requireReadable(***REMOVED***Id, caller);
        MaterialQuery q = query == null ? new MaterialQuery() : query;
        long current = q.getCurrent() < 1 ? 1 : q.getCurrent();
        long size = q.getSize() < 1 ? DEFAULT_PAGE_SIZE : Math.min(q.getSize(), MAX_PAGE_SIZE);
        String tenant = caller.getTenantCode();
        String safe***REMOVED***Id = ***REMOVED***Id.trim();
        List<String> categoryIds = resolveCategoryScope(tenant, safe***REMOVED***Id, q.getCategoryId());

        QueryWrapper<MaterialEntity> base = new QueryWrapper<>();
        base.eq("tenant_code", tenant).eq("***REMOVED***_id", safe***REMOVED***Id).eq("is_deleted", 0);
        if (hasText(q.getKeyword())) {
            base.like("title", q.getKeyword().trim());
        }
        if (hasText(q.getMaterialType())) {
            base.eq("material_type", q.getMaterialType().trim().toUpperCase(Locale.ROOT));
        }
        if (hasText(q.getMaterialStatus())) {
            base.eq("material_status", q.getMaterialStatus().trim().toUpperCase(Locale.ROOT));
        }
        if (!categoryIds.isEmpty()) {
            base.in("category_id", categoryIds);
        }
        Long total = materialMapper.selectCount(base.clone());
        QueryWrapper<MaterialEntity> listQuery = base.clone()
                .orderByDesc("create_time").orderByDesc("id")
                .last("LIMIT " + size + " OFFSET " + ((current - 1) * size));
        List<MaterialEntity> rows = materialMapper.selectList(listQuery);
        Map<String, MaterialVersionEntity> versions = loadCurrentVersions(tenant, rows);
        List<MaterialView> views = new ArrayList<>();
        for (MaterialEntity row : rows) {
            views.add(toView(row, versions.get(row.getCurrentVersionId())));
        }
        return new PageResult<>(views, total == null ? 0 : total, current, size);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<MaterialUploadItem> upload(String ***REMOVED***Id, String categoryId,
                                           List<MaterialUploadFile> files, ***REMOVED***Caller caller) {
        requireActive***REMOVED***(***REMOVED***Id, caller);
        if (files == null || files.isEmpty()) {
            throw new ***REMOVED***Exception("MATERIAL_FILE_EMPTY", "上传文件不能为空");
        }
        String tenant = caller.getTenantCode();
        String safe***REMOVED***Id = ***REMOVED***Id.trim();
        String normalizedCategoryId = normalizeCategory(tenant, safe***REMOVED***Id, categoryId);
        List<MaterialUploadItem> results = new ArrayList<>();
        for (MaterialUploadFile file : files) {
            results.add(registerOne(tenant, safe***REMOVED***Id, normalizedCategoryId, file, caller));
        }
        return results;
    }

    @Override
    public MaterialAttachment uploadAttachment(String ***REMOVED***Id, String fileName, byte[] content,
                                               ***REMOVED***Caller caller) {
        String name = normalizeFileName(fileName);
        if (!hasText(name) || content == null || content.length == 0) {
            throw new ***REMOVED***Exception("MATERIAL_FILE_EMPTY", "附件为空");
        }
        if (content.length > MAX_FILE_SIZE) {
            throw new ***REMOVED***Exception("MATERIAL_FILE_TOO_LARGE", "附件超过 100MB 上限");
        }
        if (hasText(***REMOVED***Id)) {
            requireManageable(***REMOVED***Id, caller);
        }
        MaterialAttachment attachment = new MaterialAttachment();
        attachment.setFileName(name);
        attachment.setSizeBytes(content.length);
        attachment.setFileExt(extensionOf(name));
        attachment.setUrl(fileStore.storeAttachment(trimToNull(***REMOVED***Id), name, content));
        return attachment;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public MaterialUploadItem registerText(String ***REMOVED***Id, String title, String categoryId,
                                           String content, ***REMOVED***Caller caller) {
        if (!hasText(content)) {
            throw new ***REMOVED***Exception("MATERIAL_CONTENT_EMPTY", "登记文本不能为空");
        }
        requireActive***REMOVED***(***REMOVED***Id, caller);
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_FILE_SIZE) {
            throw new ***REMOVED***Exception("MATERIAL_FILE_TOO_LARGE", "登记文本超过 100MB 上限");
        }
        String tenant = caller.getTenantCode();
        String safe***REMOVED***Id = ***REMOVED***Id.trim();
        String noteTitle = syncTitle(title, "未命名笔记");
        MaterialUploadFile file = new MaterialUploadFile(fileNameOf(noteTitle), bytes.length, bytes);
        MaterialUploadItem item = registerOne(tenant, safe***REMOVED***Id,
                normalizeCategory(tenant, safe***REMOVED***Id, categoryId), file, caller);
        renameTitle(tenant, item, noteTitle, caller);
        return item;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public MaterialUploadItem registerFromUrl(String ***REMOVED***Id, String title, String fileName,
                                              String categoryId, String url, ***REMOVED***Caller caller) {
        if (!hasText(url)) {
            throw new ***REMOVED***Exception("MATERIAL_PARAM_INVALID", "原始文件地址不能为空");
        }
        requireActive***REMOVED***(***REMOVED***Id, caller);
        byte[] bytes;
        try {
            bytes = fileStore.load(url.trim());
        } catch (RuntimeException e) {
            throw new ***REMOVED***Exception("MATERIAL_ATTACHMENT_INVALID", "原始文件地址无效或文件已清理", e);
        }
        if (bytes == null || bytes.length == 0) {
            throw new ***REMOVED***Exception("MATERIAL_FILE_EMPTY", "原始文件内容为空");
        }
        String name = hasText(fileName) ? normalizeFileName(fileName) : fileNameFromUrl(url);
        String tenant = caller.getTenantCode();
        String safe***REMOVED***Id = ***REMOVED***Id.trim();
        MaterialUploadFile file = new MaterialUploadFile(name, bytes.length, bytes);
        MaterialUploadItem item = registerOne(tenant, safe***REMOVED***Id,
                normalizeCategory(tenant, safe***REMOVED***Id, categoryId), file, caller);
        if (hasText(title)) {
            renameTitle(tenant, item, syncTitle(title, name), caller);
        }
        return item;
    }

    @Override
    public MaterialDetail detail(String materialId, ***REMOVED***Caller caller) {
        String tenant = caller.getTenantCode();
        MaterialEntity material = requireMaterial(tenant, materialId);
        requireReadable(material.get***REMOVED***Id(), caller);

        List<MaterialVersionEntity> versions = listVersions(tenant, material.getMaterialId());
        MaterialVersionEntity current = findVersion(versions, material.getCurrentVersionId());
        ParsedDraftEntity draft = current == null ? null
                : selectLatestDraft(tenant, current.getVersionId());

        MaterialDetail detail = new MaterialDetail();
        detail.setMaterial(toView(material, current));
        List<MaterialVersionView> versionViews = new ArrayList<>();
        for (MaterialVersionEntity version : versions) {
            versionViews.add(toVersionView(version));
        }
        detail.setVersions(versionViews);
        detail.setCurrentDraft(toDraftView(draft));
        return detail;
    }

    @Override
    public MaterialRepoRef repoRef(String materialId, ***REMOVED***Caller caller) {
        String tenant = caller.getTenantCode();
        MaterialEntity material = requireMaterial(tenant, materialId);
        requireReadable(material.get***REMOVED***Id(), caller);
        MaterialRepoRef ref = new MaterialRepoRef();
        ref.setMaterialId(material.getMaterialId());
        ref.set***REMOVED***Id(material.get***REMOVED***Id());
        ref.setTitle(material.getTitle());
        ref.setSourceType(material.getSourceType());
        ref.setSourceBindingId(material.getSourceBindingId());
        ref.setMetadata(material.getMetadata());
        return ref;
    }

    @Override
    public List<MaterialView> listRecent(String ***REMOVED***Id, int limit, ***REMOVED***Caller caller) {
        requireReadable(***REMOVED***Id, caller);
        String tenant = caller.getTenantCode();
        int size = Math.max(1, Math.min(limit, MAX_RECENT_LIMIT));
        QueryWrapper<MaterialEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("***REMOVED***_id", ***REMOVED***Id.trim()).eq("is_deleted", 0)
                .orderByDesc("create_time").orderByDesc("id").last("LIMIT " + size);
        List<MaterialEntity> rows = materialMapper.selectList(query);
        Map<String, MaterialVersionEntity> versions = loadCurrentVersions(tenant, rows);
        List<MaterialView> result = new ArrayList<>();
        for (MaterialEntity row : rows) {
            result.add(toView(row, versions.get(row.getCurrentVersionId())));
        }
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<MaterialBatchItem> updateCategory(String ***REMOVED***Id, List<String> materialIds,
                                                  String categoryId, ***REMOVED***Caller caller) {
        requireManageable(***REMOVED***Id, caller);
        String tenant = caller.getTenantCode();
        String safe***REMOVED***Id = ***REMOVED***Id.trim();
        List<String> ids = requireIds(materialIds);
        String normalizedCategoryId = normalizeCategory(tenant, safe***REMOVED***Id, categoryId);

        Map<String, MaterialEntity> materials = loadMaterials(tenant, ids);
        List<MaterialBatchItem> results = new ArrayList<>();
        for (String id : ids) {
            MaterialBatchItem item = new MaterialBatchItem();
            item.setMaterialId(id);
            MaterialEntity material = materials.get(id);
            if (material == null) {
                item.setSuccess(false);
                item.setMessage("物料不存在或已删除");
            } else if (!safe***REMOVED***Id.equals(material.get***REMOVED***Id())) {
                item.setSuccess(false);
                item.setMessage("物料不属于当前知识库");
            } else {
                material.setCategoryId(normalizedCategoryId);
                material.setUpdateBy(caller.getActorId());
                material.setUpdateTime(Instant.now());
                int rows = materialMapper.updateById(material);
                item.setSuccess(rows > 0);
                item.setMessage(rows > 0 ? "已更新分类" : "未更新");
            }
            results.add(item);
        }
        return results;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<MaterialBatchItem> remove(String ***REMOVED***Id, List<String> materialIds, ***REMOVED***Caller caller) {
        requireManageable(***REMOVED***Id, caller);
        String tenant = caller.getTenantCode();
        String safe***REMOVED***Id = ***REMOVED***Id.trim();
        List<String> ids = requireIds(materialIds);
        Map<String, MaterialEntity> materials = loadMaterials(tenant, ids);

        List<MaterialBatchItem> results = new ArrayList<>();
        for (String id : ids) {
            MaterialBatchItem item = new MaterialBatchItem();
            item.setMaterialId(id);
            MaterialEntity material = materials.get(id);
            if (material == null) {
                item.setSuccess(false);
                item.setMessage("物料不存在或已删除");
            } else if (!safe***REMOVED***Id.equals(material.get***REMOVED***Id())) {
                item.setSuccess(false);
                item.setMessage("物料不属于当前知识库");
            } else if (MaterialStatus.DELETED.name().equals(material.getMaterialStatus())) {
                item.setSuccess(false);
                item.setMessage("物料已在回收站");
            } else {
                UpdateWrapper<MaterialEntity> update = new UpdateWrapper<>();
                update.eq("tenant_code", tenant).eq("material_id", id).eq("is_deleted", 0)
                        .set("material_status", MaterialStatus.DELETED.name())
                        .set("is_deleted", 1)
                        .set("update_by", caller.getActorId())
                        .set("update_time", Instant.now());
                int rows = materialMapper.update(null, update);
                item.setSuccess(rows > 0);
                item.setMessage(rows > 0 ? "已删除" : "未删除");
            }
            results.add(item);
        }
        return results;
    }

    @Override
    public MaterialDownload download(String materialId, String versionId, ***REMOVED***Caller caller) {
        String tenant = caller.getTenantCode();
        MaterialEntity material = requireMaterial(tenant, materialId);
        requireReadable(material.get***REMOVED***Id(), caller);
        MaterialVersionEntity version = resolveVersion(tenant, material.getMaterialId(), versionId);
        byte[] content;
        try {
            content = fileStore.load(version.getOriginalUrl());
        } catch (RuntimeException e) {
            throw new ***REMOVED***Exception("MATERIAL_NOT_FOUND", "原始文件不存在或已清理", e);
        }
        if (content == null) {
            throw new ***REMOVED***Exception("MATERIAL_NOT_FOUND", "原始文件不存在或已清理");
        }
        return new MaterialDownload(version.getFileName(), content);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public MaterialUploadItem revise(String ***REMOVED***Id, String materialId, MaterialUploadFile file,
                                     String sourceVersion, ***REMOVED***Caller caller) {
        requireActive***REMOVED***(***REMOVED***Id, caller);
        String tenant = caller.getTenantCode();
        String safe***REMOVED***Id = ***REMOVED***Id.trim();
        MaterialEntity material = requireMaterial(tenant, materialId);
        if (!safe***REMOVED***Id.equals(material.get***REMOVED***Id())) {
            throw new ***REMOVED***Exception("MATERIAL_NOT_FOUND", "物料不存在：" + materialId);
        }
        if (MaterialStatus.DELETED.name().equals(material.getMaterialStatus())) {
            throw new ***REMOVED***Exception("MATERIAL_STATUS_INVALID", "回收站中的物料不能追加版本");
        }
        return appendVersion(tenant, safe***REMOVED***Id, material, file, sourceVersion, caller);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ParsedDraftView reparse(String materialId, String versionId, ***REMOVED***Caller caller) {
        String tenant = caller.getTenantCode();
        MaterialEntity material = requireMaterial(tenant, materialId);
        requireReadable(material.get***REMOVED***Id(), caller);
        MaterialVersionEntity version = resolveVersion(tenant, material.getMaterialId(), versionId);
        return performParse(tenant, material.get***REMOVED***Id(), material.getMaterialId(), version, caller);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ParsedDraftView parseVersion(String materialId, String versionId, ***REMOVED***Caller caller) {
        String tenant = caller.getTenantCode();
        MaterialEntity material = requireMaterial(tenant, materialId);
        requireReadable(material.get***REMOVED***Id(), caller);
        MaterialVersionEntity version = requireVersion(tenant, versionId);
        if (!material.getMaterialId().equals(version.getMaterialId())) {
            throw new ***REMOVED***Exception("MATERIAL_NOT_FOUND", "版本不属于该物料：" + versionId);
        }
        return performParse(tenant, material.get***REMOVED***Id(), material.getMaterialId(), version, caller);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ParsedDraftView saveDraftText(String materialId, String versionId, String textContent,
                                         ***REMOVED***Caller caller) {
        String tenant = caller.getTenantCode();
        MaterialEntity material = requireMaterial(tenant, materialId);
        requireManageable(material.get***REMOVED***Id(), caller);
        String text = textContent == null ? "" : textContent;
        if (!hasText(text) || text.length() > MAX_DRAFT_TEXT_LENGTH) {
            throw new ***REMOVED***Exception("MATERIAL_PARAM_INVALID",
                    "解析稿正文不能为空且不超过 " + MAX_DRAFT_TEXT_LENGTH + " 个字符");
        }
        MaterialVersionEntity version = resolveVersion(tenant, material.getMaterialId(), versionId);

        ParsedDraftEntity draft = new ParsedDraftEntity();
        Instant now = Instant.now();
        draft.setId(UUID.randomUUID().toString());
        draft.setDraftId(UUID.randomUUID().toString());
        draft.setTenantCode(tenant);
        draft.set***REMOVED***Id(material.get***REMOVED***Id());
        draft.setMaterialId(material.getMaterialId());
        draft.setMaterialVersionId(version.getVersionId());
        draft.setParserName(MANUAL_PARSER_NAME);
        draft.setParserVersion(MANUAL_PARSER_VERSION);
        draft.setStatus(ParsedDraftStatus.READY.name());
        draft.setTextContent(text);
        draft.setParsedAt(now);
        draft.setIsDeleted(0);
        draft.setCreateBy(caller.getActorId());
        draft.setUpdateBy(caller.getActorId());
        draft.setCreateTime(now);
        draft.setUpdateTime(now);
        draftMapper.insert(draft);
        updateVersionDraftPointer(tenant, version.getVersionId(), draft.getDraftId(),
                MaterialVersionStatus.PARSED.name(), caller);
        return toDraftView(draft);
    }

    @Override
    public List<ParsedDraftView> listDrafts(String materialId, String versionId, ***REMOVED***Caller caller) {
        String tenant = caller.getTenantCode();
        MaterialEntity material = requireMaterial(tenant, materialId);
        requireReadable(material.get***REMOVED***Id(), caller);
        MaterialVersionEntity version = resolveVersion(tenant, material.getMaterialId(), versionId);
        List<ParsedDraftView> result = new ArrayList<>();
        for (ParsedDraftEntity draft : listDraftsOfVersion(tenant, version.getVersionId())) {
            result.add(toDraftView(draft));
        }
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<MaterialBatchItem> restore(String ***REMOVED***Id, List<String> materialIds, ***REMOVED***Caller caller) {
        requireManageable(***REMOVED***Id, caller);
        String tenant = caller.getTenantCode();
        String safe***REMOVED***Id = ***REMOVED***Id.trim();
        List<String> ids = requireIds(materialIds);

        List<MaterialBatchItem> results = new ArrayList<>();
        for (String id : ids) {
            MaterialBatchItem item = new MaterialBatchItem();
            item.setMaterialId(id);
            MaterialEntity material = selectDeletedMaterial(tenant, id);
            if (material == null) {
                item.setSuccess(false);
                item.setMessage("物料不存在或未删除");
            } else if (!safe***REMOVED***Id.equals(material.get***REMOVED***Id())) {
                item.setSuccess(false);
                item.setMessage("物料不属于当前知识库");
            } else if (countByFingerprint(tenant, safe***REMOVED***Id, material.getMaterialType(),
                    material.getFingerprint()) > 0) {
                item.setSuccess(false);
                item.setMessage("同内容资料已存在，不能恢复");
            } else {
                UpdateWrapper<MaterialEntity> update = new UpdateWrapper<>();
                update.eq("tenant_code", tenant).eq("material_id", id).eq("is_deleted", 1)
                        .set("material_status", MaterialStatus.ACTIVE.name())
                        .set("is_deleted", 0)
                        .set("update_by", caller.getActorId())
                        .set("update_time", Instant.now());
                int rows = materialMapper.update(null, update);
                item.setSuccess(rows > 0);
                item.setMessage(rows > 0 ? "已恢复" : "未恢复");
            }
            results.add(item);
        }
        return results;
    }

    @Override
    public PageResult<MaterialView> pageDeleted(String ***REMOVED***Id, String keyword, long current, long size,
                                                ***REMOVED***Caller caller) {
        requireReadable(***REMOVED***Id, caller);
        String tenant = caller.getTenantCode();
        String safe***REMOVED***Id = ***REMOVED***Id.trim();
        long pageCurrent = current < 1 ? 1 : current;
        long pageSize = size < 1 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);

        QueryWrapper<MaterialEntity> base = new QueryWrapper<>();
        base.eq("tenant_code", tenant).eq("***REMOVED***_id", safe***REMOVED***Id).eq("is_deleted", 1);
        if (hasText(keyword)) {
            base.like("title", keyword.trim());
        }
        Long total = materialMapper.selectCount(base.clone());
        QueryWrapper<MaterialEntity> listQuery = base.clone()
                .orderByDesc("update_time").orderByDesc("id")
                .last("LIMIT " + pageSize + " OFFSET " + ((pageCurrent - 1) * pageSize));
        List<MaterialEntity> rows = materialMapper.selectList(listQuery);
        Map<String, MaterialVersionEntity> versions = loadCurrentVersions(tenant, rows);
        List<MaterialView> views = new ArrayList<>();
        for (MaterialEntity row : rows) {
            views.add(toView(row, versions.get(row.getCurrentVersionId())));
        }
        return new PageResult<>(views, total == null ? 0 : total, pageCurrent, pageSize);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<MaterialBatchItem> purge(String ***REMOVED***Id, List<String> materialIds, ***REMOVED***Caller caller) {
        requireManageable(***REMOVED***Id, caller);
        String tenant = caller.getTenantCode();
        String safe***REMOVED***Id = ***REMOVED***Id.trim();
        List<String> ids = requireIds(materialIds);

        List<MaterialBatchItem> results = new ArrayList<>();
        List<String> originalUrls = new ArrayList<>();
        for (String id : ids) {
            MaterialBatchItem item = new MaterialBatchItem();
            item.setMaterialId(id);
            MaterialEntity material = selectDeletedMaterial(tenant, id);
            if (material == null) {
                item.setSuccess(false);
                item.setMessage("资料不在回收站");
            } else if (!safe***REMOVED***Id.equals(material.get***REMOVED***Id())) {
                item.setSuccess(false);
                item.setMessage("资料不属于当前知识库");
            } else {
                for (MaterialVersionEntity version : listVersions(tenant, id)) {
                    if (hasText(version.getOriginalUrl())) {
                        originalUrls.add(version.getOriginalUrl());
                    }
                }
                draftMapper.delete(draftDelete(tenant, id));
                versionMapper.delete(versionDelete(tenant, id));
                QueryWrapper<MaterialEntity> delete = new QueryWrapper<>();
                delete.eq("tenant_code", tenant).eq("***REMOVED***_id", safe***REMOVED***Id)
                        .eq("material_id", id).eq("is_deleted", 1);
                int rows = materialMapper.delete(delete);
                item.setSuccess(rows > 0);
                item.setMessage(rows > 0 ? "已彻底删除" : "未删除");
            }
            results.add(item);
        }
        deleteOriginalsAfterCommit(originalUrls);
        return results;
    }

    @Override
    public MaterialCompileSource loadCompileSource(String materialId, String versionId,
                                                   ***REMOVED***Caller caller) {
        String tenant = caller.getTenantCode();
        MaterialEntity material = requireMaterial(tenant, materialId);
        requireReadable(material.get***REMOVED***Id(), caller);
        MaterialVersionEntity version = resolveVersion(tenant, material.getMaterialId(), versionId);

        MaterialCompileSource source = new MaterialCompileSource();
        source.setMaterialId(materialId);
        source.set***REMOVED***Id(material.get***REMOVED***Id());
        source.setTitle(version.getFileName());
        source.setVersionId(version.getVersionId());
        source.setVersionNo(version.getVersionNo());
        source.setVersionStatus(version.getVersionStatus());
        source.setFileName(version.getFileName());

        ParsedDraftEntity readyDraft = null;
        ParsedDraftEntity latest = null;
        for (ParsedDraftEntity draft : listDraftsOfVersion(tenant, version.getVersionId())) {
            if (latest == null) {
                latest = draft;
            }
            if (ParsedDraftStatus.READY.name().equals(draft.getStatus())) {
                readyDraft = draft;
                break;
            }
        }
        ParsedDraftEntity selected = readyDraft != null ? readyDraft : latest;
        if (selected != null) {
            source.setDraftId(selected.getDraftId());
            source.setDraftStatus(selected.getStatus());
            source.setDraftFailureReason(selected.getFailureReason());
            if (ParsedDraftStatus.READY.name().equals(selected.getStatus())) {
                source.setTextContent(selected.getTextContent());
            }
        }
        return source;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public MaterialSyncResult syncUpsert(MaterialSyncRequest request, ***REMOVED***Caller caller) {
        if (request == null || !hasText(request.get***REMOVED***Id())) {
            throw new ***REMOVED***Exception("MATERIAL_PARAM_INVALID", "同步请求缺少知识库标识");
        }
        if (request.getContent() == null || request.getContent().length == 0) {
            return MaterialSyncResult.failed("来源内容为空");
        }
        requireActive***REMOVED***(request.get***REMOVED***Id(), caller);
        String tenant = caller.getTenantCode();
        String ***REMOVED***Id = request.get***REMOVED***Id().trim();
        String title = syncTitle(request.getTitle(), request.getFileName());
        String fileName = hasText(request.getFileName()) ? normalizeFileName(request.getFileName())
                : fileNameOf(title);
        MaterialUploadFile file = new MaterialUploadFile(fileName, request.getContent().length,
                request.getContent());
        String boundMaterialId = trimToNull(request.getMaterialId());
        MaterialUploadItem item = boundMaterialId == null
                ? registerOne(tenant, ***REMOVED***Id, trimToNull(request.getCategoryId()), file, caller)
                : revise(***REMOVED***Id, boundMaterialId, file, request.getSourceVersion(), caller);
        if (!item.isSuccess()) {
            return MaterialSyncResult.of(item.isDuplicated() ? MaterialSyncResult.UNCHANGED
                            : MaterialSyncResult.FAILED,
                    boundMaterialId, null, item.getMessage());
        }

        MaterialEntity material = selectMaterial(tenant, item.getMaterialId());
        if (material != null) {
            material.setTitle(title);
            material.setSourceType(trimToNull(request.getSourceType()));
            material.setSourceBindingId(trimToNull(request.getSourceBindingId()));
            material.setMetadata(request.getMetadata());
            material.setUpdateBy(caller.getActorId());
            material.setUpdateTime(Instant.now());
            materialMapper.updateById(material);
        }
        return MaterialSyncResult.of(
                boundMaterialId == null ? MaterialSyncResult.CREATED : MaterialSyncResult.UPDATED,
                item.getMaterialId(), item.getVersionId(), item.getMessage());
    }

    @Override
    public List<MaterialBinding> listBySource(String ***REMOVED***Id, String sourceBindingId, ***REMOVED***Caller caller) {
        requireReadable(***REMOVED***Id, caller);
        if (!hasText(sourceBindingId)) {
            return Collections.emptyList();
        }
        QueryWrapper<MaterialEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", caller.getTenantCode()).eq("***REMOVED***_id", ***REMOVED***Id.trim())
                .eq("source_binding_id", sourceBindingId.trim()).eq("is_deleted", 0);
        List<MaterialBinding> result = new ArrayList<>();
        for (MaterialEntity entity : materialMapper.selectList(query)) {
            MaterialBinding binding = new MaterialBinding();
            binding.setMaterialId(entity.getMaterialId());
            binding.setTitle(entity.getTitle());
            binding.setMaterialStatus(entity.getMaterialStatus());
            binding.setCurrentVersionId(entity.getCurrentVersionId());
            binding.setFingerprint(entity.getFingerprint());
            binding.setMetadata(entity.getMetadata());
            result.add(binding);
        }
        return result;
    }

    // ==================== 登记与版本 ====================

    private MaterialUploadItem registerOne(String tenant, String ***REMOVED***Id, String categoryId,
                                           MaterialUploadFile file, ***REMOVED***Caller caller) {
        MaterialUploadItem result = new MaterialUploadItem();
        result.setFileName(file == null ? null : file.getFileName());
        if (file == null || file.getContent() == null || file.getContent().length == 0) {
            result.setSuccess(false);
            result.setMessage("文件为空");
            return result;
        }
        String fileName = normalizeFileName(file.getFileName());
        if (!hasText(fileName)) {
            result.setSuccess(false);
            result.setMessage("文件名不合法");
            return result;
        }
        result.setFileName(fileName);
        if (file.getContent().length > MAX_FILE_SIZE) {
            result.setSuccess(false);
            result.setMessage("文件超过 100MB 上限");
            return result;
        }
        if (fileName.length() > MAX_TITLE_LENGTH) {
            fileName = fileName.substring(0, MAX_TITLE_LENGTH);
        }
        String fingerprint = sha256(file.getContent());
        if (countByFingerprint(tenant, ***REMOVED***Id, MaterialType.DOCUMENT.name(), fingerprint) > 0) {
            result.setSuccess(false);
            result.setDuplicated(true);
            result.setMessage("相同内容已存在于本库");
            return result;
        }

        Instant now = Instant.now();
        String materialId = UUID.randomUUID().toString();
        String versionId = UUID.randomUUID().toString();
        String originalUrl;
        try {
            originalUrl = fileStore.store(***REMOVED***Id, versionId, fileName, file.getContent());
        } catch (RuntimeException e) {
            result.setSuccess(false);
            result.setMessage("原件写入失败，请稍后重试");
            return result;
        }

        MaterialEntity material = new MaterialEntity();
        material.setId(UUID.randomUUID().toString());
        material.setMaterialId(materialId);
        material.setTenantCode(tenant);
        material.set***REMOVED***Id(***REMOVED***Id);
        material.setMaterialType(MaterialType.DOCUMENT.name());
        material.setEntryType(MaterialEntryType.resolve(MaterialType.DOCUMENT.name(), fileName).name());
        material.setTitle(fileName);
        material.setSourceType(SOURCE_LOCAL);
        material.setCurrentVersionId(versionId);
        material.setFingerprint(fingerprint);
        material.setMaterialStatus(MaterialStatus.ACTIVE.name());
        material.setCategoryId(categoryId);
        material.setRegisteredBy(caller.getActorId());
        material.setRegisteredAt(now);
        material.setIsDeleted(0);
        material.setCreateBy(caller.getActorId());
        material.setUpdateBy(caller.getActorId());
        material.setCreateTime(now);
        material.setUpdateTime(now);
        materialMapper.insert(material);

        MaterialVersionEntity version = new MaterialVersionEntity();
        version.setId(UUID.randomUUID().toString());
        version.setVersionId(versionId);
        version.setTenantCode(tenant);
        version.set***REMOVED***Id(***REMOVED***Id);
        version.setMaterialId(materialId);
        version.setVersionNo(1);
        version.setFingerprint(fingerprint);
        version.setSourceVersion("v1");
        version.setVersionStatus(MaterialVersionStatus.PARSING.name());
        version.setFileName(fileName);
        version.setFileExt(extensionOf(fileName));
        version.setSizeBytes((long) file.getContent().length);
        version.setOriginalUrl(originalUrl);
        version.setRegisteredAt(now);
        version.setIsDeleted(0);
        version.setCreateBy(caller.getActorId());
        version.setUpdateBy(caller.getActorId());
        version.setCreateTime(now);
        version.setUpdateTime(now);
        versionMapper.insert(version);

        ParsedDraftView draft = performParse(tenant, ***REMOVED***Id, materialId, version, caller);
        result.setSuccess(true);
        result.setMaterialId(materialId);
        result.setVersionId(versionId);
        result.setParseStatus(draft.getStatus());
        result.setMessage(ParsedDraftStatus.READY.name().equals(draft.getStatus())
                ? "已登记，解析完成" : "已登记，解析失败：" + draft.getFailureReason());
        return result;
    }

    private MaterialUploadItem appendVersion(String tenant, String ***REMOVED***Id, MaterialEntity material,
                                             MaterialUploadFile file, String sourceVersion,
                                             ***REMOVED***Caller caller) {
        MaterialUploadItem result = new MaterialUploadItem();
        result.setFileName(file == null ? null : file.getFileName());
        if (file == null || file.getContent() == null || file.getContent().length == 0) {
            result.setSuccess(false);
            result.setMessage("文件为空");
            return result;
        }
        String fileName = normalizeFileName(file.getFileName());
        if (!hasText(fileName)) {
            result.setSuccess(false);
            result.setMessage("文件名不合法");
            return result;
        }
        result.setFileName(fileName);
        if (file.getContent().length > MAX_FILE_SIZE) {
            result.setSuccess(false);
            result.setMessage("文件超过 100MB 上限");
            return result;
        }
        if (fileName.length() > MAX_TITLE_LENGTH) {
            fileName = fileName.substring(0, MAX_TITLE_LENGTH);
        }
        String fingerprint = sha256(file.getContent());
        if (fingerprint.equals(material.getFingerprint())) {
            result.setSuccess(false);
            result.setDuplicated(true);
            result.setMessage("内容与当前版本相同");
            return result;
        }
        if (countByFingerprint(tenant, ***REMOVED***Id, MaterialType.DOCUMENT.name(), fingerprint) > 0) {
            result.setSuccess(false);
            result.setDuplicated(true);
            result.setMessage("相同内容已存在于本库");
            return result;
        }

        Instant now = Instant.now();
        int versionNo = 1;
        for (MaterialVersionEntity item : listVersions(tenant, material.getMaterialId())) {
            Integer no = item.getVersionNo();
            if (no != null && no >= versionNo) {
                versionNo = no + 1;
            }
        }
        String versionId = UUID.randomUUID().toString();
        String originalUrl;
        try {
            originalUrl = fileStore.store(***REMOVED***Id, versionId, fileName, file.getContent());
        } catch (RuntimeException e) {
            result.setSuccess(false);
            result.setMessage("原件写入失败，请稍后重试");
            return result;
        }

        MaterialVersionEntity version = new MaterialVersionEntity();
        version.setId(UUID.randomUUID().toString());
        version.setVersionId(versionId);
        version.setTenantCode(tenant);
        version.set***REMOVED***Id(***REMOVED***Id);
        version.setMaterialId(material.getMaterialId());
        version.setVersionNo(versionNo);
        version.setFingerprint(fingerprint);
        version.setSourceVersion(hasText(sourceVersion) ? sourceVersion.trim() : "v" + versionNo);
        version.setVersionStatus(MaterialVersionStatus.PARSING.name());
        version.setFileName(fileName);
        version.setFileExt(extensionOf(fileName));
        version.setSizeBytes((long) file.getContent().length);
        version.setOriginalUrl(originalUrl);
        version.setRegisteredAt(now);
        version.setIsDeleted(0);
        version.setCreateBy(caller.getActorId());
        version.setUpdateBy(caller.getActorId());
        version.setCreateTime(now);
        version.setUpdateTime(now);
        versionMapper.insert(version);
        supersedeVersions(tenant, material.getMaterialId(), versionId, caller);

        material.setCurrentVersionId(versionId);
        material.setFingerprint(fingerprint);
        material.setEntryType(MaterialEntryType.resolve(material.getMaterialType(), fileName).name());
        material.setTitle(fileName);
        material.setMaterialStatus(MaterialStatus.ACTIVE.name());
        material.setUpdateBy(caller.getActorId());
        material.setUpdateTime(now);
        materialMapper.updateById(material);

        ParsedDraftView draft = performParse(tenant, ***REMOVED***Id, material.getMaterialId(), version, caller);
        result.setSuccess(true);
        result.setMaterialId(material.getMaterialId());
        result.setVersionId(versionId);
        result.setParseStatus(draft.getStatus());
        result.setMessage(ParsedDraftStatus.READY.name().equals(draft.getStatus())
                ? "已登记新版本，解析完成" : "已登记新版本，解析失败：" + draft.getFailureReason());
        return result;
    }

    /** 同步解析指定版本：写入新解析稿并把版本指针指向它。 */
    private ParsedDraftView performParse(String tenant, String ***REMOVED***Id, String materialId,
                                         MaterialVersionEntity version, ***REMOVED***Caller caller) {
        byte[] content;
        try {
            content = fileStore.load(version.getOriginalUrl());
        } catch (RuntimeException e) {
            content = null;
        }
        ParseOutcome outcome = content == null
                ? ParseOutcome.failed("原始文件不存在或已清理，无法解析")
                : parse(version.getFileName(), content);

        ParsedDraftEntity draft = new ParsedDraftEntity();
        Instant now = Instant.now();
        draft.setId(UUID.randomUUID().toString());
        draft.setDraftId(UUID.randomUUID().toString());
        draft.setTenantCode(tenant);
        draft.set***REMOVED***Id(***REMOVED***Id);
        draft.setMaterialId(materialId);
        draft.setMaterialVersionId(version.getVersionId());
        draft.setParserName(outcome.parserName);
        draft.setParserVersion(outcome.parserVersion);
        draft.setStatus(outcome.ready ? ParsedDraftStatus.READY.name()
                : ParsedDraftStatus.FAILED.name());
        draft.setTextContent(outcome.text);
        draft.setFailureReason(outcome.failureReason);
        draft.setParsedAt(now);
        draft.setIsDeleted(0);
        draft.setCreateBy(caller.getActorId());
        draft.setUpdateBy(caller.getActorId());
        draft.setCreateTime(now);
        draft.setUpdateTime(now);
        draftMapper.insert(draft);
        updateVersionDraftPointer(tenant, version.getVersionId(), draft.getDraftId(),
                outcome.ready ? MaterialVersionStatus.PARSED.name()
                        : MaterialVersionStatus.FAILED.name(), caller);
        return toDraftView(draft);
    }

    /** 按注册顺序选择第一个支持该文件名的解析器。 */
    private ParseOutcome parse(String fileName, byte[] content) {
        for (***REMOVED***MaterialParser parser : parsers) {
            if (!parser.supports(fileName)) {
                continue;
            }
            try {
                ***REMOVED***ParsedText parsed = parser.parse(fileName, content);
                if (parsed == null) {
                    return ParseOutcome.failed("解析器返回空结果");
                }
                if (parsed.isReady()) {
                    return ParseOutcome.ready(parsed.getText(), parsed.getParserName(),
                            parsed.getParserVersion());
                }
                return ParseOutcome.failed(parsed.getFailureReason(), parsed.getParserName(),
                        parsed.getParserVersion());
            } catch (RuntimeException e) {
                return ParseOutcome.failed("解析失败：" + e.getMessage());
            }
        }
        return ParseOutcome.failed("没有可用的解析器处理该格式：" + extensionOf(fileName));
    }

    private void supersedeVersions(String tenant, String materialId, String keepVersionId,
                                   ***REMOVED***Caller caller) {
        UpdateWrapper<MaterialVersionEntity> update = new UpdateWrapper<>();
        update.eq("tenant_code", tenant).eq("material_id", materialId)
                .ne("version_id", keepVersionId)
                .ne("version_status", MaterialVersionStatus.SUPERSEDED.name())
                .set("version_status", MaterialVersionStatus.SUPERSEDED.name())
                .set("update_by", caller.getActorId())
                .set("update_time", Instant.now());
        versionMapper.update(null, update);
    }

    private void updateVersionDraftPointer(String tenant, String versionId, String draftId,
                                           String versionStatus, ***REMOVED***Caller caller) {
        UpdateWrapper<MaterialVersionEntity> update = new UpdateWrapper<>();
        update.eq("tenant_code", tenant).eq("version_id", versionId)
                .set("current_parsed_draft_id", draftId)
                .set("version_status", versionStatus)
                .set("update_by", caller.getActorId())
                .set("update_time", Instant.now());
        versionMapper.update(null, update);
    }

    // ==================== 查询辅助 ====================

    private Map<String, MaterialVersionEntity> loadCurrentVersions(String tenant,
                                                                   List<MaterialEntity> materials) {
        if (materials == null || materials.isEmpty()) {
            return Collections.emptyMap();
        }
        Set<String> versionIds = new HashSet<>();
        for (MaterialEntity material : materials) {
            if (hasText(material.getCurrentVersionId())) {
                versionIds.add(material.getCurrentVersionId());
            }
        }
        if (versionIds.isEmpty()) {
            return Collections.emptyMap();
        }
        QueryWrapper<MaterialVersionEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).in("version_id", versionIds).eq("is_deleted", 0);
        Map<String, MaterialVersionEntity> result = new HashMap<>();
        for (MaterialVersionEntity version : versionMapper.selectList(query)) {
            result.put(version.getVersionId(), version);
        }
        return result;
    }

    private List<MaterialVersionEntity> listVersions(String tenant, String materialId) {
        QueryWrapper<MaterialVersionEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("material_id", materialId).eq("is_deleted", 0)
                .orderByDesc("version_no");
        return versionMapper.selectList(query);
    }

    private MaterialVersionEntity selectCurrent(String tenant, String materialId) {
        QueryWrapper<MaterialVersionEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("material_id", materialId).eq("is_deleted", 0)
                .orderByDesc("version_no").last("LIMIT 1");
        return versionMapper.selectOne(query);
    }

    private MaterialVersionEntity requireVersion(String tenant, String versionId) {
        if (!hasText(versionId)) {
            throw new ***REMOVED***Exception("MATERIAL_NOT_FOUND", "版本标识不能为空");
        }
        QueryWrapper<MaterialVersionEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("version_id", versionId.trim()).eq("is_deleted", 0);
        MaterialVersionEntity version = versionMapper.selectOne(query);
        if (version == null) {
            throw new ***REMOVED***Exception("MATERIAL_NOT_FOUND", "版本不存在：" + versionId);
        }
        return version;
    }

    private MaterialVersionEntity resolveVersion(String tenant, String materialId,
                                                 String versionId) {
        MaterialVersionEntity version = hasText(versionId)
                ? requireVersion(tenant, versionId) : selectCurrent(tenant, materialId);
        if (version == null || !materialId.equals(version.getMaterialId())) {
            throw new ***REMOVED***Exception("MATERIAL_NOT_FOUND", "版本不存在或不属于该物料");
        }
        return version;
    }

    private ParsedDraftEntity selectLatestDraft(String tenant, String versionId) {
        QueryWrapper<ParsedDraftEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("material_version_id", versionId)
                .eq("is_deleted", 0).orderByDesc("create_time").orderByDesc("id").last("LIMIT 1");
        return draftMapper.selectOne(query);
    }

    private List<ParsedDraftEntity> listDraftsOfVersion(String tenant, String versionId) {
        QueryWrapper<ParsedDraftEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("material_version_id", versionId).eq("is_deleted", 0)
                .orderByDesc("create_time").orderByDesc("id");
        return draftMapper.selectList(query);
    }

    private Map<String, MaterialEntity> loadMaterials(String tenant, List<String> ids) {
        Map<String, MaterialEntity> result = new HashMap<>();
        QueryWrapper<MaterialEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).in("material_id", ids).eq("is_deleted", 0);
        for (MaterialEntity entity : materialMapper.selectList(query)) {
            result.put(entity.getMaterialId(), entity);
        }
        return result;
    }

    private MaterialEntity selectMaterial(String tenant, String materialId) {
        if (!hasText(materialId)) {
            return null;
        }
        QueryWrapper<MaterialEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("material_id", materialId.trim()).eq("is_deleted", 0);
        return materialMapper.selectOne(query);
    }

    private MaterialEntity requireMaterial(String tenant, String materialId) {
        MaterialEntity material = selectMaterial(tenant, materialId);
        if (material == null) {
            throw new ***REMOVED***Exception("MATERIAL_NOT_FOUND", "物料不存在：" + materialId);
        }
        return material;
    }

    private MaterialEntity selectDeletedMaterial(String tenant, String materialId) {
        if (!hasText(materialId)) {
            return null;
        }
        QueryWrapper<MaterialEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("material_id", materialId.trim()).eq("is_deleted", 1);
        return materialMapper.selectOne(query);
    }

    private long countByFingerprint(String tenant, String ***REMOVED***Id, String materialType,
                                    String fingerprint) {
        QueryWrapper<MaterialEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("***REMOVED***_id", ***REMOVED***Id)
                .eq("material_type", materialType).eq("fingerprint", fingerprint)
                .eq("is_deleted", 0);
        Long count = materialMapper.selectCount(query);
        return count == null ? 0 : count;
    }

    /** 分类过滤范围：返回该分类及其全部子孙分类标识；分类不属于该库时抛 CATEGORY_NOT_FOUND。 */
    private List<String> resolveCategoryScope(String tenant, String ***REMOVED***Id, String categoryId) {
        if (!hasText(categoryId)) {
            return Collections.emptyList();
        }
        QueryWrapper<MaterialCategoryEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("***REMOVED***_id", ***REMOVED***Id).eq("is_deleted", 0);
        List<MaterialCategoryEntity> all = categoryMapper.selectList(query);
        String target = categoryId.trim();
        boolean exists = false;
        for (MaterialCategoryEntity item : all) {
            if (target.equals(item.getCategoryId())) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            throw new ***REMOVED***Exception("CATEGORY_NOT_FOUND", "分类不存在：" + categoryId);
        }
        Set<String> scope = new LinkedHashSet<>();
        scope.add(target);
        boolean changed = true;
        while (changed) {
            changed = false;
            for (MaterialCategoryEntity item : all) {
                if (scope.contains(item.getParentId()) && scope.add(item.getCategoryId())) {
                    changed = true;
                }
            }
        }
        return new ArrayList<>(scope);
    }

    private String normalizeCategory(String tenant, String ***REMOVED***Id, String categoryId) {
        if (!hasText(categoryId)) {
            return null;
        }
        QueryWrapper<MaterialCategoryEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("***REMOVED***_id", ***REMOVED***Id)
                .eq("category_id", categoryId.trim()).eq("is_deleted", 0);
        MaterialCategoryEntity category = categoryMapper.selectOne(query);
        if (category == null) {
            throw new ***REMOVED***Exception("CATEGORY_NOT_FOUND", "分类不存在：" + categoryId);
        }
        return category.getCategoryId();
    }

    /** 找回登记结果对应的物料并按用户给的标题覆盖派生标题，失败不影响本次登记结果。 */
    private void renameTitle(String tenant, MaterialUploadItem item, String title, ***REMOVED***Caller caller) {
        if (item == null || !item.isSuccess() || !hasText(title)) {
            return;
        }
        MaterialEntity material = selectMaterial(tenant, item.getMaterialId());
        if (material == null) {
            return;
        }
        material.setTitle(title);
        material.setUpdateBy(caller.getActorId());
        material.setUpdateTime(Instant.now());
        materialMapper.updateById(material);
    }

    // ==================== 视图转换 ====================

    private MaterialView toView(MaterialEntity material, MaterialVersionEntity version) {
        MaterialView view = new MaterialView();
        view.setMaterialId(material.getMaterialId());
        view.set***REMOVED***Id(material.get***REMOVED***Id());
        view.setMaterialType(material.getMaterialType());
        view.setEntryType(material.getEntryType());
        view.setTitle(material.getTitle());
        view.setSourceType(material.getSourceType());
        view.setCategoryId(material.getCategoryId());
        view.setMaterialStatus(material.getMaterialStatus());
        view.setFingerprint(material.getFingerprint());
        view.setCurrentVersionId(material.getCurrentVersionId());
        view.setRegisteredBy(material.getRegisteredBy());
        view.setRegisteredAt(material.getRegisteredAt());
        view.setUpdateTime(material.getUpdateTime());
        if (version != null) {
            view.setVersionNo(version.getVersionNo());
            view.setFileName(version.getFileName());
            view.setFileExt(version.getFileExt());
            view.setSizeBytes(version.getSizeBytes());
            view.setVersionStatus(version.getVersionStatus());
            view.setParseStatus(parseStatusOf(version.getVersionStatus()));
        }
        view.setCompileStatus(COMPILE_STATUS_NOT_COMPILED);
        view.setGovernanceStatus(GOVERNANCE_STATUS_NONE);
        return view;
    }

    private MaterialVersionView toVersionView(MaterialVersionEntity version) {
        MaterialVersionView view = new MaterialVersionView();
        view.setVersionId(version.getVersionId());
        view.setVersionNo(version.getVersionNo());
        view.setFileName(version.getFileName());
        view.setFileExt(version.getFileExt());
        view.setSizeBytes(version.getSizeBytes());
        view.setFingerprint(version.getFingerprint());
        view.setSourceVersion(version.getSourceVersion());
        view.setVersionStatus(version.getVersionStatus());
        view.setCurrentParsedDraftId(version.getCurrentParsedDraftId());
        view.setRegisteredAt(version.getRegisteredAt());
        return view;
    }

    private ParsedDraftView toDraftView(ParsedDraftEntity draft) {
        if (draft == null) {
            return null;
        }
        ParsedDraftView view = new ParsedDraftView();
        view.setDraftId(draft.getDraftId());
        view.setStatus(draft.getStatus());
        view.setParserName(draft.getParserName());
        view.setParserVersion(draft.getParserVersion());
        view.setParsedAt(draft.getParsedAt());
        view.setFailureReason(draft.getFailureReason());
        String text = draft.getTextContent();
        view.setTextLength(text == null ? 0 : text.length());
        view.setTextContent(text != null && text.length() > MAX_TEXT_PREVIEW
                ? text.substring(0, MAX_TEXT_PREVIEW) : text);
        return view;
    }

    private String parseStatusOf(String versionStatus) {
        if (MaterialVersionStatus.PARSED.name().equals(versionStatus)) {
            return ParsedDraftStatus.READY.name();
        }
        if (MaterialVersionStatus.FAILED.name().equals(versionStatus)) {
            return ParsedDraftStatus.FAILED.name();
        }
        return ParsedDraftStatus.PARSING.name();
    }

    private MaterialVersionEntity findVersion(List<MaterialVersionEntity> versions, String versionId) {
        if (versions == null || versions.isEmpty()) {
            return null;
        }
        for (MaterialVersionEntity version : versions) {
            if (version.getVersionId().equals(versionId)) {
                return version;
            }
        }
        return versions.get(0);
    }

    private QueryWrapper<ParsedDraftEntity> draftDelete(String tenant, String materialId) {
        QueryWrapper<ParsedDraftEntity> delete = new QueryWrapper<>();
        delete.eq("tenant_code", tenant).eq("material_id", materialId);
        return delete;
    }

    private QueryWrapper<MaterialVersionEntity> versionDelete(String tenant, String materialId) {
        QueryWrapper<MaterialVersionEntity> delete = new QueryWrapper<>();
        delete.eq("tenant_code", tenant).eq("material_id", materialId);
        return delete;
    }

    /** 事务提交后清理原始文件；清理失败只记录而不回滚已完成的删除。 */
    private void deleteOriginalsAfterCommit(List<String> originalUrls) {
        if (originalUrls.isEmpty()) {
            return;
        }
        Runnable cleanup = () -> {
            for (String url : originalUrls) {
                fileStore.deleteQuietly(url);
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    cleanup.run();
                }
            });
        } else {
            cleanup.run();
        }
    }

    // ==================== 校验与工具 ====================

    private void requireReadable(String ***REMOVED***Id, ***REMOVED***Caller caller) {
        if (!hasText(***REMOVED***Id)) {
            throw new ***REMOVED***Exception("***REMOVED***NOT_FOUND", "知识库不存在或已删除");
        }
        resourceService.requireReadable(***REMOVED***Id.trim(), caller);
    }

    private KnowledgeBaseView requireManageable(String ***REMOVED***Id, ***REMOVED***Caller caller) {
        if (!hasText(***REMOVED***Id)) {
            throw new ***REMOVED***Exception("***REMOVED***NOT_FOUND", "知识库不存在或已删除");
        }
        return resourceService.requireActionable(***REMOVED***Id.trim(), KnowledgeBaseAction.MATERIAL_WRITE, caller);
    }

    private KnowledgeBaseView requireActive***REMOVED***(String ***REMOVED***Id, ***REMOVED***Caller caller) {
        KnowledgeBaseView view = requireManageable(***REMOVED***Id, caller);
        if (view.getStatus() != KnowledgeBaseStatus.ACTIVE) {
            throw new ***REMOVED***Exception("***REMOVED***STATUS_INVALID", "只有生效中的知识库可以登记资料");
        }
        return view;
    }

    private List<String> requireIds(List<String> materialIds) {
        if (materialIds == null || materialIds.isEmpty()) {
            throw new ***REMOVED***Exception("MATERIAL_PARAM_INVALID", "物料标识列表不能为空");
        }
        Set<String> ids = new LinkedHashSet<>();
        for (String id : materialIds) {
            if (hasText(id)) {
                ids.add(id.trim());
            }
        }
        if (ids.isEmpty()) {
            throw new ***REMOVED***Exception("MATERIAL_PARAM_INVALID", "物料标识列表不能为空");
        }
        if (ids.size() > MAX_BATCH_SIZE) {
            throw new ***REMOVED***Exception("MATERIAL_PARAM_INVALID", "单次批量操作不超过 " + MAX_BATCH_SIZE + " 条");
        }
        return new ArrayList<>(ids);
    }

    private String syncTitle(String title, String fileName) {
        String value = hasText(title) ? title.trim() : (fileName == null ? "" : fileName.trim());
        return value.length() > MAX_TITLE_LENGTH ? value.substring(0, MAX_TITLE_LENGTH) : value;
    }

    /** 由标题派生文件名：替换文件系统非法字符，落到 markdown 扩展名以便按文本解析。 */
    private String fileNameOf(String title) {
        String base = title == null ? "" : title.replaceAll("[\\\\/:*?\"<>|\\r\\n\\t]", "_").trim();
        if (base.isEmpty()) {
            base = "untitled";
        }
        return (base.length() > MAX_FILENAME_BASE ? base.substring(0, MAX_FILENAME_BASE) : base) + ".md";
    }

    private String fileNameFromUrl(String url) {
        String path = url == null ? "" : url.trim();
        int query = path.indexOf('?');
        if (query >= 0) {
            path = path.substring(0, query);
        }
        int slash = path.lastIndexOf('/');
        String name = slash >= 0 ? path.substring(slash + 1) : path;
        try {
            name = URLDecoder.decode(name, StandardCharsets.UTF_8.name());
        } catch (RuntimeException | java.io.UnsupportedEncodingException ignored) {
            // 解码失败时保留原始末段
        }
        if (!hasText(name)) {
            return "attachment.md";
        }
        return name.length() > MAX_TITLE_LENGTH ? name.substring(0, MAX_TITLE_LENGTH) : name;
    }

    /** 清洗文件名：去空格并剥离路径部分，仅保留最后一段文件名。 */
    private String normalizeFileName(String value) {
        if (!hasText(value)) {
            return null;
        }
        String name = value.trim();
        int slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        if (slash >= 0) {
            name = name.substring(slash + 1);
        }
        return name.trim();
    }

    private String extensionOf(String fileName) {
        int dot = fileName == null ? -1 : fileName.lastIndexOf('.');
        if (dot < 0 || dot == fileName.length() - 1) {
            return "";
        }
        return fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private String sha256(byte[] content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(content);
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte value : hash) {
                builder.append(String.format("%02x", value));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new ***REMOVED***Exception("MATERIAL_PARAM_INVALID", "当前运行环境不支持 SHA-256");
        }
    }

    private static String trimToNull(String value) {
        return hasText(value) ? value.trim() : null;
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    /** 一次解析结果，解析器信息与失败原因随解析稿一起落盘。 */
    private static final class ParseOutcome {

        private final boolean ready;
        private final String text;
        private final String failureReason;
        private final String parserName;
        private final String parserVersion;

        private ParseOutcome(boolean ready, String text, String failureReason, String parserName,
                             String parserVersion) {
            this.ready = ready;
            this.text = text;
            this.failureReason = failureReason;
            this.parserName = parserName;
            this.parserVersion = parserVersion;
        }

        private static ParseOutcome ready(String text, String parserName, String parserVersion) {
            return new ParseOutcome(true, text, null,
                    parserName == null ? "unknown" : parserName,
                    parserVersion == null ? "unknown" : parserVersion);
        }

        private static ParseOutcome failed(String reason) {
            return failed(reason, "none", "0");
        }

        private static ParseOutcome failed(String reason, String parserName, String parserVersion) {
            return new ParseOutcome(false, null, reason,
                    parserName == null ? "none" : parserName,
                    parserVersion == null ? "0" : parserVersion);
        }
    }
}
