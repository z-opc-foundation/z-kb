package com.zifang.z.kb.web.controller;

import com.zifang.z.kb.api.SearchQuery;
import com.zifang.z.kb.api.SearchResult;
import com.zifang.z.kb.api.SearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import jakarta.annotation.Resource;

/**
 * 检索 REST API。
 */
@Tag(name = "检索")
@RestController
@RequestMapping("/api/kb/search")
public class SearchController {

    @Resource
    private SearchService searchService;

    @Operation(summary = "统一检索")
    @PostMapping
    public SearchResult search(@RequestBody SearchQuery query) {
        if (query.getWorkspace() == null) query.setWorkspace("default");
        if (query.getTopK() <= 0) query.setTopK(10);
        return searchService.search(query);
    }
}
