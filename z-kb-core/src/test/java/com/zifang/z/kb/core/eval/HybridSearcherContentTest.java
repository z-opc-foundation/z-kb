package com.zifang.z.kb.core.eval;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.ChunkVectorStore;
import com.zifang.z.kb.api.Document;
import com.zifang.z.kb.api.DocumentRepository;
import com.zifang.z.kb.api.SearchMode;
import com.zifang.z.kb.api.SearchQuery;
import com.zifang.z.kb.api.SearchResult;
import com.zifang.z.kb.api.Workspace;
import com.zifang.z.kb.core.embedding.TfIdfEmbeddingProvider;
import com.zifang.z.kb.core.extractor.EntityExtractor;
import com.zifang.z.kb.core.search.Bm25Searcher;
import com.zifang.z.kb.core.search.HybridSearcher;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 融合后 hit 必须带正文。
 *
 * <p>这是评测暴露出来的缺陷：FUSION/HYBRID 下向量路的 hit 从不携带正文，而融合按列表顺序
 * 先到先得，向量路在前，于是同一个 chunk 被两路召回时保留的是那份空壳 hit；向量路独占的
 * 命中更是永远没有正文。生成侧评测因此给模型喂了空参考资料，「检索反而更差」是假象。
 */
class HybridSearcherContentTest {

    private static final String WORKSPACE = "content";
    private static final String CHUNK_TEXT = "Redis 缓存穿透可以用布隆过滤器拦截不存在的键。";
    private static final String CHUNK_QUERYABLE = "缓存穿透 布隆过滤器";

    @Test
    @DisplayName("向量与关键词都命中的 chunk，融合后仍要带正文")
    void fusionKeepsContentWhenBothRoutesHit() {
        Fixture f = fixture(false);
        SearchResult r = f.searcher.search(query(SearchMode.FUSION));

        assertTrue(r.getHits().size() > 0, "无命中，测试前提不成立");
        for (com.zifang.z.kb.api.SearchHit hit : r.getHits()) {
            assertNotNull(hit.getContent(), "FUSION 命中 " + hit.getChunkId() + " 正文为 null");
            assertEquals(CHUNK_TEXT, hit.getContent());
        }
    }

    @Test
    @DisplayName("只有向量路命中的 chunk，正文由 chunk 仓库回填")
    void vectorOnlyHitGetsContentBackfilled() {
        Fixture f = fixture(true);
        SearchResult r = f.searcher.search(query(SearchMode.FUSION));

        assertTrue(r.getHits().size() > 0, "无命中，测试前提不成立");
        assertEquals(1, r.getHits().size());
        assertEquals(CHUNK_TEXT, r.getHits().get(0).getContent());
    }

    @Test
    @DisplayName("includeContent=false 时不得回填")
    void contentSuppressedWhenNotRequested() {
        Fixture f = fixture(true);
        SearchQuery q = query(SearchMode.VECTOR);
        q.setIncludeContent(false);
        SearchResult r = f.searcher.search(q);

        for (com.zifang.z.kb.api.SearchHit hit : r.getHits()) {
            assertTrue(hit.getContent() == null, "不该回填正文");
        }
    }

    private static SearchQuery query(SearchMode mode) {
        SearchQuery q = new SearchQuery();
        q.setQuery(CHUNK_QUERYABLE);
        q.setWorkspace(WORKSPACE);
        q.setMode(mode);
        q.setTopK(10);
        return q;
    }

    private static Fixture fixture(boolean keywordSeesNothing) {
        Chunk chunk = new Chunk();
        chunk.setId("c1");
        chunk.setDocumentId("d1");
        chunk.setWorkspace(WORKSPACE);
        chunk.setContent(CHUNK_TEXT);
        chunk.setEmbedding(new TfIdfEmbeddingProvider().embed(CHUNK_TEXT));

        InMemoryStores.Vector vectorStore = new InMemoryStores.Vector();
        vectorStore.createCollection(WORKSPACE, ChunkVectorStore.DEFAULT_CHUNK_COLLECTION, 512);
        vectorStore.upsert(WORKSPACE, ChunkVectorStore.DEFAULT_CHUNK_COLLECTION,
                new ArrayList<>(java.util.Collections.singletonList(chunk)));

        Bm25Searcher bm25 = new Bm25Searcher();
        if (!keywordSeesNothing) {
            bm25.addChunks(java.util.Collections.singletonList(chunk));
        }

        TfIdfEmbeddingProvider embedder = new TfIdfEmbeddingProvider();
        embedder.trainIdf(java.util.Collections.singletonList(CHUNK_TEXT));
        // 查询向量必须与文档向量在同一 IDF 状态下产生
        chunk.setEmbedding(embedder.embed(CHUNK_TEXT));
        vectorStore.upsert(WORKSPACE, ChunkVectorStore.DEFAULT_CHUNK_COLLECTION,
                java.util.Collections.singletonList(chunk));

        HybridSearcher searcher = new HybridSearcher(vectorStore, new InMemoryStores.Graph(), bm25,
                embedder, new EntityExtractor(), new StubDocumentRepository(chunk));
        return new Fixture(searcher);
    }

    private static final class Fixture {
        final HybridSearcher searcher;
        Fixture(HybridSearcher searcher) { this.searcher = searcher; }
    }

    /** 只实现检索链路真正用到的方法；其余抛异常以免被误当成可用实现 */
    private static final class StubDocumentRepository implements DocumentRepository {
        private final Map<String, Chunk> byId = new HashMap<String, Chunk>();

        StubDocumentRepository(Chunk chunk) {
            byId.put(chunk.getId(), chunk);
        }

        @Override
        public Chunk findChunkById(String workspace, String id) {
            return byId.get(id);
        }

        @Override public Document save(Document doc) { throw new UnsupportedOperationException(); }
        @Override public Document findById(String w, String id) { throw new UnsupportedOperationException(); }
        @Override public Document findByPath(String w, String p) { throw new UnsupportedOperationException(); }
        @Override public List<Document> listByWorkspace(String w, int o, int l) { throw new UnsupportedOperationException(); }
        @Override public List<Document> listByTags(String w, List<String> t, int o, int l) { throw new UnsupportedOperationException(); }
        @Override public long countByWorkspace(String w) { throw new UnsupportedOperationException(); }
        @Override public boolean softDelete(String w, String id) { throw new UnsupportedOperationException(); }
        @Override public boolean hardDelete(String w, String id) { throw new UnsupportedOperationException(); }
        @Override public List<Document> findByIds(String w, List<String> ids) { throw new UnsupportedOperationException(); }
        @Override public List<Document> searchByTitle(String w, String k, int l) { throw new UnsupportedOperationException(); }
        @Override public Chunk saveChunk(Chunk c) { throw new UnsupportedOperationException(); }
        @Override public List<Chunk> saveChunks(List<Chunk> cs) { throw new UnsupportedOperationException(); }
        @Override public List<Chunk> findChunksByDocument(String w, String d) { throw new UnsupportedOperationException(); }
        @Override public List<Chunk> findChunksByIds(String w, List<String> ids) { throw new UnsupportedOperationException(); }
        @Override public int deleteChunksByDocument(String w, String d) { throw new UnsupportedOperationException(); }
        @Override public Workspace createWorkspace(Workspace ws) { throw new UnsupportedOperationException(); }
        @Override public Workspace getWorkspace(String id) { throw new UnsupportedOperationException(); }
        @Override public Workspace getWorkspaceByName(String n) { throw new UnsupportedOperationException(); }
        @Override public List<Workspace> listWorkspaces() { throw new UnsupportedOperationException(); }
    }
}
