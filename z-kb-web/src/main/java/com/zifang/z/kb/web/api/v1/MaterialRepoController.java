package com.zifang.z.***REMOVED***.web.api.v1;

import com.zifang.z.***REMOVED***.api.material.MaterialRepoBrowseService;
import com.zifang.z.***REMOVED***.api.material.RepoEntry;
import com.zifang.z.***REMOVED***.api.material.RepoFile;
import com.zifang.z.***REMOVED***.api.material.RepoOverview;
import com.zifang.z.***REMOVED***.protocol.response.***REMOVED***Result;
import com.zifang.z.***REMOVED***.web.caller.***REMOVED***CallerResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 代码仓库资料的只读浏览（对齐参考实现）。
 */
@Tag(name = "物料-代码仓库")
@RestController
@RequestMapping("/api/***REMOVED***/v1/material/repo")
public class MaterialRepoController {

    private final MaterialRepoBrowseService repoBrowseService;
    private final ***REMOVED***CallerResolver callerResolver;

    public MaterialRepoController(MaterialRepoBrowseService repoBrowseService,
                                  ***REMOVED***CallerResolver callerResolver) {
        this.repoBrowseService = repoBrowseService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "代码仓库概览")
    @GetMapping("/overview")
    public ***REMOVED***Result<RepoOverview> overview(@RequestParam String materialId,
                                           HttpServletRequest request) {
        return ***REMOVED***Result.ok(repoBrowseService.overview(materialId,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "代码仓库目录")
    @GetMapping("/tree")
    public ***REMOVED***Result<List<RepoEntry>> tree(@RequestParam String materialId,
                                          @RequestParam(required = false) String path,
                                          HttpServletRequest request) {
        return ***REMOVED***Result.ok(repoBrowseService.listEntries(materialId, path,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "代码仓库文件")
    @GetMapping("/file")
    public ***REMOVED***Result<RepoFile> file(@RequestParam String materialId,
                                   @RequestParam String path,
                                   HttpServletRequest request) {
        return ***REMOVED***Result.ok(repoBrowseService.readFile(materialId, path,
                callerResolver.resolve(request)));
    }
}
