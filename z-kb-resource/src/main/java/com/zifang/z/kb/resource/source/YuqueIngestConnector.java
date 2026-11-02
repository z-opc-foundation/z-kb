package com.zifang.z.kb.resource.source;

import com.zifang.util.json.JsonUtil;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceAccess;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceProvider;
import com.zifang.z.kb.core.source.IngestDocContent;
import com.zifang.z.kb.core.source.IngestDocRef;
import com.zifang.z.kb.core.source.IngestSyncInfo;
import com.zifang.z.kb.core.source.YuqueSelection;
import com.zifang.z.kb.core.source.YuqueTocRefs;
import com.zifang.z.kb.core.source.yuque.YuqueApiClient;
import com.zifang.z.kb.core.source.yuque.YuqueApiException;
import com.zifang.z.kb.core.source.yuque.YuqueDoc;
import com.zifang.z.kb.core.source.yuque.YuqueDocContent;
import com.zifang.z.kb.core.source.yuque.YuqueDocReader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 语雀知识库 → 物料。同步范围可以是多个知识库，每个库再按文章白名单收窄；
 * 每篇文档的集合取「目录 DOC 节点 ∪ 文档列表」：目录只覆盖拖进大纲的文档，
 * 没进大纲的文档只有文档列表能看到；路径与层级来自目录，大纲外的文档以标题作路径。
 * 文档列表的 content_updated_at 定正文版本，正文本身就是 markdown（表格类文档先转成
 * markdown 表格），登记后挂在对应知识库的资料树节点下。
 */
public class YuqueIngestConnector implements IngestConnector {

    private static final Logger LOG = LoggerFactory.getLogger(YuqueIngestConnector.class);

    private static final String SOURCE_TYPE = "YUQUE";

    private static final int DOC_PAGE_SIZE = 100;

    /** 单次同步最多翻 200 页（2 万篇），防止异常翻页把同步拖死。 */
    private static final int MAX_DOC_PAGES = 200;

    private final YuqueApiClient yuqueApiClient;

    private final YuqueDocReader docReader;

    private final DocIngestRunner runner;

    private final SourceTreeNodes sourceTreeNodes;

    public YuqueIngestConnector(YuqueApiClient yuqueApiClient, YuqueDocReader docReader,
            DocIngestRunner runner, SourceTreeNodes sourceTreeNodes) {
        this.yuqueApiClient = yuqueApiClient;
        this.docReader = docReader;
        this.runner = runner;
        this.sourceTreeNodes = sourceTreeNodes;
    }

    @Override
    public KnowledgeBaseSourceProvider provider() {
        return KnowledgeBaseSourceProvider.YUQUE;
    }

    /** 语雀同步至少要选中一个知识库，并且手里有可用的 Token。 */
    @Override
    public void checkScope(KnowledgeBaseSourceAccess source) {
        if (YuqueSelection.books(source).isEmpty()
                || source.resolveSecret() == null || source.resolveSecret().trim().isEmpty()) {
            throw new KBException("KB_SOURCE_CONFIG_INVALID",
                    "语雀接入源需要至少一个知识库和访问令牌");
        }
    }

    @Override
    public String inputSnapshot(KnowledgeBaseSourceAccess source) {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("sourceId", source.getSourceId());
        node.put("provider", source.getProvider());
        List<YuqueSelection.Book> books = YuqueSelection.books(source);
        node.put("bookCount", books.size());
        int docCount = 0;
        for (YuqueSelection.Book book : books) {
            docCount += book.getDocs() == null ? 0 : book.getDocs().size();
        }
        node.put("selectedDocCount", docCount);
        return JsonUtil.toJson(node);
    }

    @Override
    public IngestSyncInfo sync(String kbId, KnowledgeBaseSourceAccess source, KbCaller caller) {
        checkScope(source);
        String token = source.resolveSecret();
        YuqueApiClient client = yuqueApiClient.withBaseUrl(source.scopeValue("apiBaseUrl"));
        List<YuqueSelection.Book> books = YuqueSelection.books(source);
        String sourceCategoryId = sourceTreeNodes.ensureSourceNode(kbId, source, caller);

        List<IngestDocRef> refs = new ArrayList<>();
        Map<String, String> versions = new LinkedHashMap<>();
        boolean readable = true;
        for (YuqueSelection.Book book : books) {
            String categoryId = sourceTreeNodes.ensureBookNode(kbId, sourceCategoryId, source,
                    book, caller);
            if (!appendBook(refs, versions, client, token, book, categoryId)) {
                readable = false;
            }
        }
        return runner.run(kbId, source.getSourceId(), SOURCE_TYPE, books.get(0).getBook(), refs,
                versions, readable, ref -> read(client, ref.getBookScope(), token, ref), caller);
    }

    /** 读一个知识库的文档集合，按文章白名单收窄；返回 false 表示这个库整体没读出来。 */
    private boolean appendBook(List<IngestDocRef> refs, Map<String, String> versions,
            YuqueApiClient client, String token, YuqueSelection.Book book, String categoryId) {
        String namespace = book.getBook().trim();
        List<IngestDocRef> bookRefs = new ArrayList<>();
        boolean tocRead = true;
        try {
            bookRefs.addAll(YuqueTocRefs.build(client.fetchToc(namespace, token)));
        } catch (YuqueApiException e) {
            tocRead = false;
            LOG.warn("语雀目录读取失败，改用文档列表 namespace={} reason={}", namespace,
                    e.getMessage());
        }
        boolean listRead = appendDocsOutsideToc(bookRefs, versions, client, namespace, token);
        Set<String> selected = selectedSlugs(book);
        for (IngestDocRef ref : bookRefs) {
            if (selected != null && !selected.contains(ref.getSlug())) {
                continue;
            }
            refs.add(new IngestDocRef(ref.getSlug(), ref.getTitle(), ref.getDocId(), ref.getPath(),
                    ref.getLevel(), namespace, categoryId));
        }
        return tocRead || listRead;
    }

    /** 选集为空表示整库；返回 null 让调用方跳过白名单过滤。 */
    private Set<String> selectedSlugs(YuqueSelection.Book book) {
        if (book.getDocs() == null || book.getDocs().isEmpty()) {
            return null;
        }
        Set<String> slugs = new HashSet<>();
        for (YuqueSelection.Doc doc : book.getDocs()) {
            if (doc != null && doc.getSlug() != null && !doc.getSlug().trim().isEmpty()) {
                slugs.add(doc.getSlug().trim());
            }
        }
        return slugs.isEmpty() ? null : slugs;
    }

    private IngestDocContent read(YuqueApiClient client, String namespace, String token,
            IngestDocRef ref) {
        YuqueDocContent doc = docReader.read(client, namespace, ref.getSlug(), token);
        return new IngestDocContent(doc.getMarkdown(), doc.getDocId(), doc.getUpdatedAt());
    }

    /**
     * 分页读文档列表：补齐没进目录大纲的文档，同时拿到每篇的正文更新时间。
     * 列表接口不可用时保持目录结果，同步仍能跑通（只是每篇都会重新拉全文）。
     * 返回 false 表示列表没读出来。
     */
    private boolean appendDocsOutsideToc(List<IngestDocRef> refs, Map<String, String> versions,
            YuqueApiClient client, String namespace, String token) {
        Set<String> known = new LinkedHashSet<>();
        for (IngestDocRef ref : refs) {
            known.add(ref.getSlug());
        }
        int offset = 0;
        for (int page = 0; page < MAX_DOC_PAGES; page++) {
            List<YuqueDoc> docs;
            try {
                docs = client.listDocs(namespace, token, offset, DOC_PAGE_SIZE);
            } catch (YuqueApiException e) {
                LOG.warn("语雀文档列表读取失败，本次只同步目录覆盖的文档 namespace={} reason={}",
                        namespace, e.getMessage());
                return false;
            }
            for (YuqueDoc doc : docs) {
                String slug = doc.getSlug();
                if (slug == null) {
                    continue;
                }
                if (doc.getContentUpdatedAt() != null) {
                    versions.put(slug, doc.getContentUpdatedAt());
                }
                if (!known.add(slug)) {
                    continue;
                }
                String title = doc.getTitle() == null ? slug : doc.getTitle();
                refs.add(new IngestDocRef(slug, title, doc.getDocId(), title, 0));
            }
            if (docs.size() < DOC_PAGE_SIZE) {
                return true;
            }
            offset += DOC_PAGE_SIZE;
        }
        return true;
    }
}
