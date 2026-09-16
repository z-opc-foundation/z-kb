package com.zifang.z.kb.web.controller;

import com.zifang.z.kb.api.SearchQuery;
import com.zifang.z.kb.api.SearchResult;
import com.zifang.z.kb.api.SearchService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;

/**
 * 检索 REST API。
 */
@Api(tags = "检索")
@RestController
@RequestMapping("/api/kb/search")
public class SearchController {

    @Resource
    private SearchService searchService;

    @ApiOperation("统一检索")
    @PostMapping
    public SearchResult search(@RequestBody SearchQuery query) {
        if (query.getWorkspace() == null) query.setWorkspace("default");
        if (query.getTopK() <= 0) query.setTopK(10);
        return searchService.search(query);
    }
}
