package com.zifang.z.***REMOVED***.resource.source;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.util.json.JsonCursor;
import com.zifang.z.***REMOVED***.api.***REMOVED***Exception;
import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseAction;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseView;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceAccess;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceCatalogDocsParam;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceCatalogParam;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceCatalogView;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceCategory;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceDocListView;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceParam;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceProvider;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceSaveParam;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceService;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceTestParam;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceTestView;
import com.zifang.z.***REMOVED***.api.source.KnowledgeBaseSourceView;
import com.zifang.z.***REMOVED***.core.source.SourcePolicyJson;
import com.zifang.z.***REMOVED***.core.source.YuqueSelection;
import com.zifang.z.***REMOVED***.core.source.git.GitApiClient;
import com.zifang.z.***REMOVED***.core.source.git.GitApiException;
import com.zifang.z.***REMOVED***.core.source.git.GitAuth;
import com.zifang.z.***REMOVED***.core.source.git.GitRepoUrl;
import com.zifang.z.***REMOVED***.api.source.LocalDirScanner;
import com.zifang.z.***REMOVED***.core.source.yuque.YuqueApiClient;
import com.zifang.z.***REMOVED***.core.source.yuque.YuqueApiException;
import com.zifang.z.***REMOVED***.core.source.yuque.YuqueBook;
import com.zifang.z.***REMOVED***.core.source.yuque.YuqueDoc;
import com.zifang.z.***REMOVED***.core.source.yuque.YuqueGroup;
import com.zifang.z.***REMOVED***.resource.***REMOVED***AuditService;
import com.zifang.z.***REMOVED***.storage.resource.entity.KnowledgeBaseProfileEntity;
import com.zifang.z.***REMOVED***.storage.resource.mapper.KnowledgeBaseProfileMapper;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 知识库接入源：配置存 {@code z***REMOVED***_knowledge_base_profile.source_policy}，
 * 列表脱敏、保存全量覆盖、探测只读、语雀可选项按需加载。权限一律走
 * {@link KnowledgeBaseResourceService}，不读线程上下文。
 */
public class DefaultKnowledgeBaseSourceService implements KnowledgeBaseSourceService {

    private static final int MAX_SOURCES = 20;

    private static final int MAX_NAME_LENGTH = 100;

    private static final int CATALOG_PAGE_SIZE = 100;

    /** 团队与知识库列表各最多翻 20 页（2000 条），防止异常翻页。 */
    private static final int MAX_CATALOG_PAGES = 20;

    /** source_policy 列宽 4000，留一点余量给多字节字符。 */
    private static final int MAX_POLICY_LENGTH = 4000;

    private static final String CREDENTIAL_NONE = "NONE";

    private static final String CREDENTIAL_TOKEN = "TOKEN";

    private static final String CREDENTIAL_BASIC = "BASIC";

    private final KnowledgeBaseResourceService resourceService;

    private final KnowledgeBaseProfileMapper profileMapper;

    private final ***REMOVED***AuditService auditService;

    private final YuqueApiClient yuqueApiClient;

    private final GitApiClient gitApiClient;

    public DefaultKnowledgeBaseSourceService(KnowledgeBaseResourceService resourceService,
            KnowledgeBaseProfileMapper profileMapper, ***REMOVED***AuditService auditService,
            YuqueApiClient yuqueApiClient, GitApiClient gitApiClient) {
        this.resourceService = resourceService;
        this.profileMapper = profileMapper;
        this.auditService = auditService;
        this.yuqueApiClient = yuqueApiClient;
        this.gitApiClient = gitApiClient;
    }

    @Override
    public List<KnowledgeBaseSourceView> listSources(String ***REMOVED***Id, ***REMOVED***Caller caller) {
        KnowledgeBaseView ***REMOVED*** = resourceService.requireReadable(***REMOVED***Id, caller);
        return toViews(readStore(***REMOVED***, caller).getSources());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<KnowledgeBaseSourceView> saveSources(KnowledgeBaseSourceSaveParam param,
            ***REMOVED***Caller caller) {
        String ***REMOVED***Id = param == null ? null : param.get***REMOVED***Id();
        if (!hasText(***REMOVED***Id)) {
            throw new ***REMOVED***Exception("***REMOVED***SOURCE_CONFIG_INVALID", "保存接入源需要知识库标识");
        }
        KnowledgeBaseView ***REMOVED*** = resourceService.requireActionable(***REMOVED***Id.trim(),
                KnowledgeBaseAction.***REMOVED***MANAGE, caller);
        KnowledgeBaseProfileEntity profile = requireProfile(***REMOVED***, caller);
        Map<String, SourcePolicyJson.Entry> existing = indexById(
                SourcePolicyJson.read(profile.getSourcePolicy()).getSources());

        List<KnowledgeBaseSourceParam> sources = param.getSources();
        if (sources.size() > MAX_SOURCES) {
            throw new ***REMOVED***Exception("***REMOVED***SOURCE_LIMIT", "接入源最多 " + MAX_SOURCES + " 个");
        }
        Set<String> sourceIds = new HashSet<>();
        List<SourcePolicyJson.Entry> next = new ArrayList<>();
        for (KnowledgeBaseSourceParam source : sources) {
            SourcePolicyJson.Entry entry = toEntry(source, existing);
            if (!sourceIds.add(entry.getSourceId())) {
                throw new ***REMOVED***Exception("***REMOVED***SOURCE_CONFIG_INVALID",
                        "接入源标识重复：" + entry.getSourceId());
            }
            next.add(entry);
        }
        SourcePolicyJson.Store store = new SourcePolicyJson.Store();
        store.setSources(next);
        String serialized = SourcePolicyJson.write(store);
        if (serialized.length() > MAX_POLICY_LENGTH) {
            throw new ***REMOVED***Exception("***REMOVED***SOURCE_CONFIG_INVALID", "接入源配置过大，请减少数量或范围");
        }
        profile.setSourcePolicy(serialized);
        profile.setUpdateBy(caller.getActorId());
        profile.setUpdateTime(Instant.now());
        profileMapper.updateById(profile);
        auditService.record(caller, ***REMOVED***.get***REMOVED***Id(), "***REMOVED***.source.save", "SOURCE_POLICY", ***REMOVED***.get***REMOVED***Id(),
                "保存接入源 " + next.size() + " 个");
        return toViews(next);
    }

    @Override
    public KnowledgeBaseSourceTestView testConnection(KnowledgeBaseSourceTestParam param,
            ***REMOVED***Caller caller) {
        String ***REMOVED***Id = param == null ? null : param.get***REMOVED***Id();
        if (!hasText(***REMOVED***Id) || param.getSource() == null) {
            throw new ***REMOVED***Exception("***REMOVED***SOURCE_CONFIG_INVALID", "连通性测试需要知识库与接入源");
        }
        KnowledgeBaseView ***REMOVED*** = resourceService.requireActionable(***REMOVED***Id.trim(),
                KnowledgeBaseAction.***REMOVED***MANAGE, caller);
        Map<String, SourcePolicyJson.Entry> existing = indexById(
                SourcePolicyJson.read(requireProfile(***REMOVED***, caller).getSourcePolicy()).getSources());
        return probe(toEntry(param.getSource(), existing));
    }

    @Override
    public KnowledgeBaseSourceCatalogView catalog(KnowledgeBaseSourceCatalogParam param,
            ***REMOVED***Caller caller) {
        String ***REMOVED***Id = param == null ? null : param.get***REMOVED***Id();
        if (!hasText(***REMOVED***Id) || param.getSource() == null) {
            throw new ***REMOVED***Exception("***REMOVED***SOURCE_CONFIG_INVALID", "加载可选项需要知识库与接入源");
        }
        KnowledgeBaseView ***REMOVED*** = resourceService.requireActionable(***REMOVED***Id.trim(),
                KnowledgeBaseAction.***REMOVED***MANAGE, caller);
        Map<String, SourcePolicyJson.Entry> existing = indexById(
                SourcePolicyJson.read(requireProfile(***REMOVED***, caller).getSourcePolicy()).getSources());
        SourcePolicyJson.Entry entry = toCatalogEntry(param.getSource(), existing);
        if (!KnowledgeBaseSourceProvider.YUQUE.name().equals(entry.getProvider())) {
            throw new ***REMOVED***Exception("***REMOVED***SOURCE_CONFIG_INVALID", "只有语雀接入源支持加载可选项");
        }
        KnowledgeBaseSourceCatalogView view = new KnowledgeBaseSourceCatalogView();
        String token = resolveSecret(entry);
        if (!hasText(token)) {
            view.setMessage("缺少访问令牌，填好令牌后再加载");
            return view;
        }
        YuqueApiClient client = yuqueApiClient.withBaseUrl(scopeText(entry, "apiBaseUrl"));
        try {
            JsonCursor user = client.getUser(token);
            String login = text(user, "login");
            if (!hasText(login)) {
                view.setMessage("读取语雀账号失败：未返回 login");
                return view;
            }
            appendSpaces(view.getSpaces(), client, login, token);
            String namespace = scopeText(entry, "namespace");
            if (namespace != null) {
                appendBooks(view.getBooks(), client, namespace, token);
            }
        } catch (YuqueApiException e) {
            view.setMessage(e.getMessage());
        }
        return view;
    }

    @Override
    public KnowledgeBaseSourceDocListView catalogDocs(KnowledgeBaseSourceCatalogDocsParam param,
            ***REMOVED***Caller caller) {
        String ***REMOVED***Id = param == null ? null : param.get***REMOVED***Id();
        if (!hasText(***REMOVED***Id) || param.getSource() == null || !hasText(param.getBook())) {
            throw new ***REMOVED***Exception("***REMOVED***SOURCE_CONFIG_INVALID", "加载文章列表需要知识库、接入源与知识库标识");
        }
        KnowledgeBaseView ***REMOVED*** = resourceService.requireActionable(***REMOVED***Id.trim(),
                KnowledgeBaseAction.***REMOVED***MANAGE, caller);
        Map<String, SourcePolicyJson.Entry> existing = indexById(
                SourcePolicyJson.read(requireProfile(***REMOVED***, caller).getSourcePolicy()).getSources());
        SourcePolicyJson.Entry entry = toCatalogEntry(param.getSource(), existing);
        if (!KnowledgeBaseSourceProvider.YUQUE.name().equals(entry.getProvider())) {
            throw new ***REMOVED***Exception("***REMOVED***SOURCE_CONFIG_INVALID", "只有语雀接入源支持加载文章列表");
        }
        KnowledgeBaseSourceDocListView view = new KnowledgeBaseSourceDocListView();
        String token = resolveSecret(entry);
        if (!hasText(token)) {
            view.setMessage("缺少访问令牌，填好令牌后再加载");
            return view;
        }
        YuqueApiClient client = yuqueApiClient.withBaseUrl(scopeText(entry, "apiBaseUrl"));
        String book = param.getBook().trim();
        try {
            for (int page = 0; page < MAX_CATALOG_PAGES; page++) {
                List<YuqueDoc> docs = client.listDocs(book, token, page * CATALOG_PAGE_SIZE,
                        CATALOG_PAGE_SIZE);
                for (YuqueDoc doc : docs) {
                    String slug = doc.getSlug();
                    if (!hasText(slug)) {
                        continue;
                    }
                    KnowledgeBaseSourceDocListView.Doc item = new KnowledgeBaseSourceDocListView.Doc();
                    item.setSlug(slug);
                    item.setTitle(hasText(doc.getTitle()) ? doc.getTitle() : slug);
                    item.setUpdatedAt(doc.getContentUpdatedAt());
                    view.getDocs().add(item);
                }
                if (docs.size() < CATALOG_PAGE_SIZE) {
                    break;
                }
            }
        } catch (YuqueApiException e) {
            view.setMessage(e.getMessage());
        }
        return view;
    }

    @Override
    public KnowledgeBaseSourceAccess requireAccess(String ***REMOVED***Id, String sourceId, ***REMOVED***Caller caller) {
        return loadAccess(***REMOVED***Id, sourceId, KnowledgeBaseAction.***REMOVED***MANAGE, caller);
    }

    @Override
    public KnowledgeBaseSourceAccess requireReadAccess(String ***REMOVED***Id, String sourceId,
            ***REMOVED***Caller caller) {
        return loadAccess(***REMOVED***Id, sourceId, KnowledgeBaseAction.***REMOVED***READ, caller);
    }

    // ==================== 内部工具 ====================

    /** 团队空间列表：语雀按 login 标识团队，分页读完为止。 */
    private void appendSpaces(List<KnowledgeBaseSourceCatalogView.Space> target,
            YuqueApiClient client, String login, String token) {
        for (int page = 0; page < MAX_CATALOG_PAGES; page++) {
            List<YuqueGroup> groups = client.listUserGroups(login, token, page * CATALOG_PAGE_SIZE,
                    CATALOG_PAGE_SIZE);
            for (YuqueGroup group : groups) {
                if (!hasText(group.getSlug())) {
                    continue;
                }
                KnowledgeBaseSourceCatalogView.Space space = new KnowledgeBaseSourceCatalogView.Space();
                space.setSlug(group.getSlug());
                space.setName(hasText(group.getName()) ? group.getName() : group.getSlug());
                target.add(space);
            }
            if (groups.size() < CATALOG_PAGE_SIZE) {
                return;
            }
        }
    }

    /** 选定团队下的知识库列表；items_count 为该库文档数，用来判断同步体量。 */
    private void appendBooks(List<KnowledgeBaseSourceCatalogView.Book> target,
            YuqueApiClient client, String namespace, String token) {
        for (int page = 0; page < MAX_CATALOG_PAGES; page++) {
            List<YuqueBook> books = client.listBooks(namespace, token, page * CATALOG_PAGE_SIZE,
                    CATALOG_PAGE_SIZE);
            for (YuqueBook book : books) {
                if (!hasText(book.getSlug())) {
                    continue;
                }
                KnowledgeBaseSourceCatalogView.Book item = new KnowledgeBaseSourceCatalogView.Book();
                item.setSlug(book.getSlug());
                item.setNamespace(hasText(book.getNamespace())
                        ? book.getNamespace() : namespace + "/" + book.getSlug());
                item.setName(hasText(book.getName()) ? book.getName() : book.getSlug());
                item.setDocsCount(book.getDocsCount());
                item.setVisibility(book.getVisibility());
                target.add(item);
            }
            if (books.size() < CATALOG_PAGE_SIZE) {
                return;
            }
        }
    }

    /** 可选项加载只关心供应商、范围与凭据，名称等必填项允许为空。 */
    private SourcePolicyJson.Entry toCatalogEntry(KnowledgeBaseSourceParam source,
            Map<String, SourcePolicyJson.Entry> existing) {
        KnowledgeBaseSourceProvider provider = KnowledgeBaseSourceProvider.of(source.getProvider());
        if (provider == null) {
            throw new ***REMOVED***Exception("***REMOVED***SOURCE_CONFIG_INVALID", "未知的接入源供应商");
        }
        String sourceId = hasText(source.getSourceId()) ? source.getSourceId().trim() : "";
        SourcePolicyJson.Entry previous = sourceId.isEmpty() ? null : existing.get(sourceId);
        SourcePolicyJson.Entry entry = new SourcePolicyJson.Entry();
        entry.setSourceId(sourceId);
        entry.setProvider(provider.name());
        entry.setScope(source.getScope() == null ? new LinkedHashMap<>()
                : new LinkedHashMap<>(source.getScope()));
        entry.setCredentialType(source.getCredentialType());
        entry.setSecret(trimToNull(source.getSecret()));
        entry.setSecretRef(trimToNull(source.getSecretRef()));
        if (entry.getSecret() == null && previous != null) {
            entry.setSecret(previous.getSecret());
            if (entry.getSecretRef() == null) {
                entry.setSecretRef(previous.getSecretRef());
            }
        }
        return entry;
    }

    private String scopeText(SourcePolicyJson.Entry entry, String key) {
        Object value = entry.getScope() == null ? null : entry.getScope().get(key);
        String text = value == null ? null : String.valueOf(value).trim();
        return hasText(text) ? text : null;
    }

    /** 校验库权限后装配接入源完整配置；读浏览与写同步共用同一装配逻辑，只差动作。 */
    private KnowledgeBaseSourceAccess loadAccess(String ***REMOVED***Id, String sourceId,
            KnowledgeBaseAction action, ***REMOVED***Caller caller) {
        if (!hasText(***REMOVED***Id) || !hasText(sourceId)) {
            throw new ***REMOVED***Exception("***REMOVED***SOURCE_CONFIG_INVALID", "缺少知识库或接入源标识");
        }
        KnowledgeBaseView ***REMOVED*** = resourceService.requireActionable(***REMOVED***Id.trim(), action, caller);
        SourcePolicyJson.Entry entry = indexById(
                SourcePolicyJson.read(requireProfile(***REMOVED***, caller).getSourcePolicy()).getSources())
                .get(sourceId.trim());
        if (entry == null) {
            throw new ***REMOVED***Exception("***REMOVED***SOURCE_CONFIG_INVALID", "接入源不存在：" + sourceId);
        }
        KnowledgeBaseSourceAccess access = new KnowledgeBaseSourceAccess();
        access.setSourceId(entry.getSourceId());
        access.setCategory(entry.getCategory());
        access.setProvider(entry.getProvider());
        access.setName(entry.getName());
        access.setEnabled(entry.getEnabled());
        access.setScope(entry.getScope());
        access.setCredentialType(entry.getCredentialType());
        access.setCredentialUsername(entry.getCredentialUsername());
        access.setSecret(entry.getSecret());
        access.setSecretRef(entry.getSecretRef());
        return access;
    }

    /** 校验并转换单条入参；未带新凭据时沿用已保存的明文或引用。 */
    private SourcePolicyJson.Entry toEntry(KnowledgeBaseSourceParam source,
            Map<String, SourcePolicyJson.Entry> existing) {
        if (source == null) {
            throw new ***REMOVED***Exception("***REMOVED***SOURCE_CONFIG_INVALID", "接入源不能为空");
        }
        KnowledgeBaseSourceProvider provider = KnowledgeBaseSourceProvider.of(source.getProvider());
        if (provider == null) {
            throw new ***REMOVED***Exception("***REMOVED***SOURCE_CONFIG_INVALID", "未知的接入源供应商");
        }
        String name = source.getName() == null ? "" : source.getName().trim();
        if (name.isEmpty() || name.length() > MAX_NAME_LENGTH) {
            throw new ***REMOVED***Exception("***REMOVED***SOURCE_CONFIG_INVALID",
                    "接入源名称必填且不超过 " + MAX_NAME_LENGTH + " 字");
        }
        String sourceId = hasText(source.getSourceId()) ? source.getSourceId().trim()
                : UUID.randomUUID().toString();
        String category = hasText(source.getCategory())
                ? source.getCategory().trim().toUpperCase() : provider.getCategory().name();
        KnowledgeBaseSourceCategory resolved = KnowledgeBaseSourceCategory.of(category);
        if (resolved != provider.getCategory()) {
            throw new ***REMOVED***Exception("***REMOVED***SOURCE_CONFIG_INVALID", "接入源分类与供应商不匹配");
        }
        SourcePolicyJson.Entry previous = existing.get(sourceId);
        String credentialType = normalizeCredentialType(source.getCredentialType(), provider);
        SourcePolicyJson.Entry entry = new SourcePolicyJson.Entry();
        entry.setSourceId(sourceId);
        entry.setCategory(category);
        entry.setProvider(provider.name());
        entry.setName(name);
        entry.setEnabled(source.getEnabled() == null || source.getEnabled());
        entry.setScope(source.getScope() == null ? new LinkedHashMap<>()
                : new LinkedHashMap<>(source.getScope()));
        entry.setCredentialType(credentialType);
        entry.setCredentialUsername(trimToNull(source.getCredentialUsername()));
        if (provider == KnowledgeBaseSourceProvider.YUQUE) {
            validateYuqueSyncScope(entry.getScope());
        }
        if (CREDENTIAL_NONE.equals(credentialType)) {
            entry.setSecretRef(null);
            entry.setSecret(null);
            return entry;
        }
        entry.setSecretRef(trimToNull(source.getSecretRef()));
        String secret = trimToNull(source.getSecret());
        if (secret == null && previous != null) {
            secret = previous.getSecret();
        }
        entry.setSecret(secret);
        return entry;
    }

    /**
     * 语雀至少要有一个可同步的知识库：新配置走 selection，老配置走 namespace + book。
     * 每个知识库标识必须是「团队/知识库」，否则同步时无法拼出请求地址。
     */
    private void validateYuqueSyncScope(Map<String, Object> scope) {
        List<YuqueSelection.Book> books = YuqueSelection.books(scope);
        if (books.isEmpty()) {
            throw new ***REMOVED***Exception("***REMOVED***SOURCE_CONFIG_INVALID", "语雀接入源至少选择一个知识库");
        }
        for (YuqueSelection.Book book : books) {
            if (book.getBook() == null || !book.getBook().contains("/")) {
                throw new ***REMOVED***Exception("***REMOVED***SOURCE_CONFIG_INVALID",
                        "语雀知识库标识必须是「团队/知识库」：" + book.getBook());
            }
        }
    }

    private String normalizeCredentialType(String value, KnowledgeBaseSourceProvider provider) {
        String type = hasText(value) ? value.trim().toUpperCase() : null;
        if (type == null) {
            if (provider == KnowledgeBaseSourceProvider.YUQUE) {
                return CREDENTIAL_TOKEN;
            }
            if (provider == KnowledgeBaseSourceProvider.GIT) {
                return CREDENTIAL_BASIC;
            }
            return CREDENTIAL_NONE;
        }
        // 本地接入源是本机路径，没有任何远端服务可认证 —— 强制免凭据，
        // 免得让人填一个根本不存在的密钥。
        if (provider == KnowledgeBaseSourceProvider.LOCAL) {
            return CREDENTIAL_NONE;
        }
        if (CREDENTIAL_NONE.equals(type) || CREDENTIAL_TOKEN.equals(type)
                || CREDENTIAL_BASIC.equals(type)) {
            return type;
        }
        throw new ***REMOVED***Exception("***REMOVED***SOURCE_CONFIG_INVALID", "凭据类型只能是 NONE / TOKEN / BASIC");
    }

    private SourcePolicyJson.Store readStore(KnowledgeBaseView ***REMOVED***, ***REMOVED***Caller caller) {
        return SourcePolicyJson.read(requireProfile(***REMOVED***, caller).getSourcePolicy());
    }

    private KnowledgeBaseProfileEntity requireProfile(KnowledgeBaseView ***REMOVED***, ***REMOVED***Caller caller) {
        QueryWrapper<KnowledgeBaseProfileEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", caller.getTenantCode()).eq("***REMOVED***_id", ***REMOVED***.get***REMOVED***Id());
        KnowledgeBaseProfileEntity profile = profileMapper.selectOne(query);
        if (profile == null) {
            throw new ***REMOVED***Exception("***REMOVED***NOT_FOUND", "知识库配置档案不存在：" + ***REMOVED***.get***REMOVED***Id());
        }
        return profile;
    }

    private Map<String, SourcePolicyJson.Entry> indexById(List<SourcePolicyJson.Entry> entries) {
        Map<String, SourcePolicyJson.Entry> index = new HashMap<>();
        if (entries == null) {
            return index;
        }
        for (SourcePolicyJson.Entry entry : entries) {
            if (entry != null && hasText(entry.getSourceId())) {
                index.put(entry.getSourceId(), entry);
            }
        }
        return index;
    }

    private List<KnowledgeBaseSourceView> toViews(List<SourcePolicyJson.Entry> entries) {
        List<KnowledgeBaseSourceView> views = new ArrayList<>();
        if (entries == null) {
            return views;
        }
        for (SourcePolicyJson.Entry entry : entries) {
            KnowledgeBaseSourceView view = new KnowledgeBaseSourceView();
            view.setSourceId(entry.getSourceId());
            view.setCategory(entry.getCategory());
            view.setProvider(entry.getProvider());
            view.setName(entry.getName());
            view.setEnabled(entry.getEnabled());
            view.setScope(entry.getScope());
            view.setCredentialType(entry.getCredentialType());
            view.setCredentialUsername(entry.getCredentialUsername());
            view.setSecretRef(entry.getSecretRef());
            view.setHasSecret(hasText(entry.getSecret()) || hasText(entry.getSecretRef()));
            views.add(view);
        }
        return views;
    }

    /** 只探测「能不能连通」：语雀与 Git 发一次只读请求，其余供应商如实返回不支持。 */
    private KnowledgeBaseSourceTestView probe(SourcePolicyJson.Entry entry) {
        long start = System.currentTimeMillis();
        KnowledgeBaseSourceProvider provider = KnowledgeBaseSourceProvider.of(entry.getProvider());
        if (provider == null) {
            return result(false, "未知的接入源供应商", start);
        }
        if (provider == KnowledgeBaseSourceProvider.YUQUE) {
            return probeYuque(entry, start);
        }
        if (provider == KnowledgeBaseSourceProvider.GIT) {
            return probeGit(entry, start);
        }
        if (provider == KnowledgeBaseSourceProvider.LOCAL) {
            return probeLocal(entry, start);
        }
        return result(false, "该供应商暂不支持连通性测试", start);
    }

    /**
     * 本地目录探测：目录在、能读，就算连通。
     *
     * <p>顺带报出扫到多少篇 Markdown —— 人配完接入源第一件事就是想确认「它到底
     * 看到了什么」，只回一句「连接成功」等于让人自己去猜。</p>
     */
    private KnowledgeBaseSourceTestView probeLocal(SourcePolicyJson.Entry entry, long start) {
        String dir = scopeText(entry, "path");
        if (!hasText(dir)) {
            return result(false, "缺少目录路径", start);
        }
        Path root = Paths.get(dir).toAbsolutePath().normalize();
        if (!Files.isDirectory(root)) {
            return result(false, "目录不存在或不是目录：" + dir, start);
        }
        if (!Files.isReadable(root)) {
            return result(false, "目录不可读：" + dir, start);
        }
        try {
            List<LocalDirScanner.LocalDoc> docs = LocalDirScanner.scan(root, true,
                    LocalDirScanner.DEFAULT_LIMIT);
            return result(true, "连接成功（扫到 " + docs.size() + " 篇 Markdown）", start);
        } catch (IOException e) {
            return result(false, "扫描目录失败：" + e.getMessage(), start);
        }
    }

    /** 语雀探测发一次 GET /user：能拿到用户即连通，凭据问题按异常消息如实返回。 */
    private KnowledgeBaseSourceTestView probeYuque(SourcePolicyJson.Entry entry, long start) {
        String token = resolveSecret(entry);
        if (!hasText(token)) {
            return result(false, "缺少访问令牌", start);
        }
        try {
            JsonCursor user = yuqueApiClient.withBaseUrl(scopeText(entry, "apiBaseUrl"))
                    .getUser(token);
            String login = text(user, "login");
            return result(true, hasText(login) ? "连接成功（" + login + "）" : "连接成功", start);
        } catch (YuqueApiException e) {
            return result(false, e.getMessage(), start);
        }
    }

    private KnowledgeBaseSourceTestView probeGit(SourcePolicyJson.Entry entry, long start) {
        String repo = scopeText(entry, "repo");
        if (!hasText(repo)) {
            return result(false, "缺少仓库地址", start);
        }
        GitRepoUrl url = GitRepoUrl.parse(repo);
        if (url == null) {
            return result(false, "暂只支持 HTTPS 仓库地址，SSH 地址请改为 HTTPS", start);
        }
        String secret = resolveSecret(entry);
        if (!hasText(secret)) {
            return result(false, "缺少仓库密码或访问令牌", start);
        }
        GitAuth auth = GitAuth.of(entry.getCredentialType(), entry.getCredentialUsername(), secret);
        try {
            JsonCursor project = gitApiClient.getProject(url.getBaseUrl(), url.getProjectPath(),
                    auth);
            String name = text(project, "path_with_namespace");
            return result(true, hasText(name) ? "连接成功（" + name + "）" : "连接成功", start);
        } catch (GitApiException e) {
            if (CREDENTIAL_BASIC.equalsIgnoreCase(entry.getCredentialType())
                    && e.getKind() == GitApiException.Kind.UNAUTHORIZED) {
                return result(false, e.getMessage()
                        + "（同步走 GitLab REST，请把凭据类型改为访问令牌）", start);
            }
            return result(false, e.getMessage(), start);
        }
    }

    /** 凭据优先取明文，其次按 secretRef 读环境变量或系统属性。 */
    private String resolveSecret(SourcePolicyJson.Entry entry) {
        if (hasText(entry.getSecret())) {
            return entry.getSecret();
        }
        if (!hasText(entry.getSecretRef())) {
            return null;
        }
        String ref = entry.getSecretRef().trim();
        String value = System.getenv(ref);
        return value != null ? value : System.getProperty(ref);
    }

    private KnowledgeBaseSourceTestView result(boolean reachable, String message, long start) {
        KnowledgeBaseSourceTestView view = new KnowledgeBaseSourceTestView();
        view.setReachable(reachable);
        view.setMessage(message);
        view.setLatencyMs(System.currentTimeMillis() - start);
        return view;
    }

    private static String text(JsonCursor node, String field) {
        JsonCursor value = node == null ? JsonCursor.missing() : node.path(field);
        if (value.isMissing() || value.isNull()) {
            return null;
        }
        String text = value.asText();
        return hasText(text) ? text : null;
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private static String trimToNull(String value) {
        if (!hasText(value)) {
            return null;
        }
        return value.trim();
    }
}
