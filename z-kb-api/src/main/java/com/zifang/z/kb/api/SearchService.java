package com.zifang.z.kb.api;

/**
 * 检索服务 — 混合检索入口。
 */
public interface SearchService {

    /**
     * 统一检索入口。
     *
     * <p>根据 {@link SearchQuery#getMode()} 选择召回策略：
     * <ul>
     *   <li>{@code VECTOR} — 仅向量</li>
     *   <li>{@code KEYWORD} — 仅关键词（BM25）</li>
     *   <li>{@code GRAPH} — 仅图谱（实体匹配 + N 跳）</li>
     *   <li>{@code HYBRID} — 向量 + 关键词（RRF 融合）</li>
     *   <li>{@code FUSION} — 向量 + 关键词 + 图谱（RRF 融合）</li>
     * </ul>
     */
    SearchResult search(SearchQuery query);
}
