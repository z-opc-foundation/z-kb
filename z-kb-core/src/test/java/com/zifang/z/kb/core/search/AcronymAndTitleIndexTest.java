package com.zifang.z.kb.core.search;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.SearchQuery;
import com.zifang.z.kb.api.SearchHit;
import com.zifang.z.kb.core.util.HanLpTokenizer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 守住两个真实召回缺陷：
 * <ul>
 *   <li>连续大写缩写被驼峰拆分器打散成单字母，再被单字符过滤丢弃 → API/OPC/SQL 恒搜不到</li>
 *   <li>标题（contextTitle）不入 BM25 索引 → 「按文档标题搜」零命中</li>
 * </ul>
 */
class AcronymAndTitleIndexTest {

    private static final String WS = "ws";

    @Test
    @DisplayName("连续大写缩写保持完整，不被拆成单字母")
    void acronymSurvivesCamelSplit() {
        for (String word : Arrays.asList("OPC", "API", "SQL", "URL", "HTTP")) {
            List<String> tokens = HanLpTokenizer.tokenize(word);
            assertTrue(tokens.contains(word.toLowerCase(java.util.Locale.ROOT)),
                    word + " 被拆散了: " + tokens);
        }
    }

    @Test
    @DisplayName("驼峰与首字母缩写仍能正确切分")
    void camelCaseStillSplits() {
        assertTrue(HanLpTokenizer.tokenize("InfluxDB").contains("influx"));
        assertTrue(HanLpTokenizer.tokenize("InfluxDB").contains("db"));
        assertTrue(HanLpTokenizer.tokenize("userId").contains("user"));
        assertTrue(HanLpTokenizer.tokenize("HTTPServer").contains("http"));
        assertTrue(HanLpTokenizer.tokenize("HTTPServer").contains("server"));
    }

    @Test
    @DisplayName("按标题搜得到：标题只存在于 contextTitle 时也能命中")
    void titleIsIndexed() {
        Chunk c = new Chunk();
        c.setId("c1");
        c.setDocumentId("d1");
        c.setWorkspace(WS);
        // 正文刻意不含标题词，与真实链路一致（H1 被 Chunker 摘进 contextTitle）
        c.setContent("本平台提供统一管理与调度能力。");
        c.setContextTitle("部署指南 (Docker)");

        Bm25Searcher bm25 = new Bm25Searcher();
        bm25.addChunks(java.util.Collections.singletonList(c));

        assertEquals(1, search(bm25, "部署指南").size(), "标题词未入索引");
        assertEquals(1, search(bm25, "Docker").size(), "标题中的缩写未入索引");
    }

    @Test
    @DisplayName("正文里的缩写同样可检索")
    void acronymInContentIsSearchable() {
        Chunk c = new Chunk();
        c.setId("c1");
        c.setDocumentId("d1");
        c.setWorkspace(WS);
        c.setContent("完整 API 文档见 Knife4j 页面");

        Bm25Searcher bm25 = new Bm25Searcher();
        bm25.addChunks(java.util.Collections.singletonList(c));

        assertEquals(1, search(bm25, "API").size(), "正文缩写未命中");
    }

    private static List<SearchHit> search(Bm25Searcher bm25, String query) {
        SearchQuery q = new SearchQuery();
        q.setQuery(query);
        q.setWorkspace(WS);
        q.setTopK(5);
        q.setIncludeContent(true);
        return bm25.search(q);
    }

    private static void assertEquals(int expected, int actual, String msg) {
        org.junit.jupiter.api.Assertions.assertEquals(expected, actual, msg);
    }
}
