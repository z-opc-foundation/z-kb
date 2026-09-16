package com.zifang.z.kb.starter.service;

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

    public DefaultSearchService(HybridSearcher hybridSearcher) {
        this.hybridSearcher = hybridSearcher;
    }

    @Override
    public SearchResult search(SearchQuery query) {
        return hybridSearcher.search(query);
    }
}
