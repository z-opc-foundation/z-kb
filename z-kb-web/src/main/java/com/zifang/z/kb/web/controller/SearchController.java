package com.zifang.z.***REMOVED***.web.controller;

import com.zifang.z.***REMOVED***.api.SearchQuery;
import com.zifang.z.***REMOVED***.api.SearchResult;
import com.zifang.z.***REMOVED***.api.SearchService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;

/**
 * 检索 REST API。
 */
@Api(tags = "检索")
@RestController
@RequestMapping("/api/***REMOVED***/search")
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
