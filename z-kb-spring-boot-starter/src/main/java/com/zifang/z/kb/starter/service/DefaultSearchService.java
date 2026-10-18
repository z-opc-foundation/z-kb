package com.zifang.z.kb.starter.service;

import com.zifang.z.kb.api.KbMetrics;
import com.zifang.z.kb.api.SearchHit;
import com.zifang.z.kb.api.SearchQuery;
import com.zifang.z.kb.api.SearchResult;
import com.zifang.z.kb.api.SearchService;
import com.zifang.z.kb.core.search.HybridSearcher;
import org.springframework.stereotype.Service;

/**
 * 默认检索服务实现 — 委托给 HybridSearcher。
 */
@Service
public class DefaultSearchService implements SearchService {

    private final HybridSearcher hybridSearcher;
    /** 可为 null：下游没带 actuator 时无埋点，其余行为不变 */
    private final KbMetrics metrics;

    public DefaultSearchService(HybridSearcher hybridSearcher) {
        this(hybridSearcher, null);
    }

    public DefaultSearchService(HybridSearcher hybridSearcher, KbMetrics metrics) {
        this.hybridSearcher = hybridSearcher;
        this.metrics = metrics;
    }

    @Override
    public SearchResult search(SearchQuery query) {
        SearchResult result = hybridSearcher.search(query);
        if (metrics != null) {
            metrics.recordSearch(
                    result.getMode() == null ? null : result.getMode().name(),
                    result.getElapsedMillis(),
                    result.getTotalHits(),
                    countMissingContent(result),
                    stat(result, "degradedRoutes"));
        }
        return result;
    }

    /**
     * 命中里正文为空的条数。恒为 0 才对 —— 非 0 说明 RAG 在拿空上下文问答，
     * 而问答仍然「看起来正常」，线上不会有任何报错。
     */
    private static int countMissingContent(SearchResult result) {
        int missing = 0;
        if (result.getHits() == null) {
            return 0;
        }
        for (SearchHit hit : result.getHits()) {
            if (hit.getContent() == null || hit.getContent().isEmpty()) {
                missing++;
            }
        }
        return missing;
    }

    private static int stat(SearchResult result, String key) {
        Integer v = result.getStats() == null ? null : result.getStats().get(key);
        return v == null ? 0 : v;
    }
}
