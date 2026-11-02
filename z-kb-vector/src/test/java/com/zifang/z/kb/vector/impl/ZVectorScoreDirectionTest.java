package com.zifang.z.kb.vector.impl;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.ChunkVectorStore;
import com.zifang.z.vector.core.InMemoryVectorStore;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 守住 score 方向语义。
 *
 * <p>z-vector 返回的是距离（越小越近），z-kb 契约要求越大越近。曾经直接透传，
 * 实测症状是向量路首位恒为「该工作台第一篇文档」——因为距离最大的那条排在最前，
 * 而 minScore 阈值又把真正相关的低距离命中全滤掉了。
 *
 * <p>用真实的 z-vector 后端，避免 stub 把被测语义也一起 stub 掉。
 */
class ZVectorScoreDirectionTest {

    private static final String WS = "ws";

    @Test
    @DisplayName("score 已转成相似度：越相似的排得越前，且远超 minScore 默认阈值 0")
    void scoreIsSimilarityNotDistance() {
        InMemoryVectorStore store = new InMemoryVectorStore();
        ZVectorChunkVectorStore adapter = new ZVectorChunkVectorStore(store, 3);
        adapter.createCollection(WS, ChunkVectorStore.DEFAULT_CHUNK_COLLECTION, 3);

        // near 与 query 同向，far 与 query 正交
        adapter.upsert(WS, ChunkVectorStore.DEFAULT_CHUNK_COLLECTION, Arrays.asList(
                chunk("far", 0f, 1f, 0f), chunk("near", 1f, 0f, 0f)));

        List<ChunkVectorStore.VectorMatch> hits =
                adapter.search(WS, ChunkVectorStore.DEFAULT_CHUNK_COLLECTION,
                        new float[]{1f, 0f, 0f}, 5, null);

        assertTrue(hits.size() >= 2, "召回数不足: " + hits.size());
        assertTrue(hits.get(0).chunkId.startsWith("near"),
                "最相似的没排第一，实际首位: " + hits.get(0).chunkId);

        float best = hits.get(0).score;
        float worst = hits.get(hits.size() - 1).score;
        assertTrue(best > worst, "score 未按相似度递减：best=" + best + " worst=" + worst);
        assertTrue(best > 0.5f, "最相关项竟低于 0.5，方向可能仍反着: " + best);
    }

    private static Chunk chunk(String id, float x, float y, float z) {
        Chunk c = new Chunk();
        c.setId(id + "-chunk");
        c.setDocumentId(id);
        c.setWorkspace(WS);
        c.setContent(id);
        c.setEmbedding(new float[]{x, y, z});
        return c;
    }
}
