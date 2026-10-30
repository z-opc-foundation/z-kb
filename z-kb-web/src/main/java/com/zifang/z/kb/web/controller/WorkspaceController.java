package com.zifang.z.***REMOVED***.web.controller;

import com.zifang.z.***REMOVED***.api.***REMOVED***Statistics;
import com.zifang.z.***REMOVED***.api.KnowledgeBaseService;
import com.zifang.z.***REMOVED***.api.Workspace;
import com.zifang.z.***REMOVED***.protocol.request.CreateWorkspaceRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import jakarta.annotation.Resource;
import java.util.List;

/**
 * 工作台 REST API。
 */
@Tag(name = "工作台")
@RestController
@RequestMapping("/api/***REMOVED***/workspaces")
public class WorkspaceController {

    @Resource
    private KnowledgeBaseService ***REMOVED***Service;

    @Operation(summary = "创建工作台")
    @PostMapping
    public Workspace create(@RequestBody CreateWorkspaceRequest body) {
        return ***REMOVED***Service.createWorkspace(body.getName(), body.getDescription());
    }

    @Operation(summary = "按名称查询工作台")
    @GetMapping("/{name}")
    public Workspace get(@PathVariable String name) {
        return ***REMOVED***Service.getWorkspace(name);
    }

    @Operation(summary = "列出所有工作台")
    @GetMapping
    public List<Workspace> list() {
        return ***REMOVED***Service.listWorkspaces();
    }

    @Operation(summary = "工作台综合统计")
    @GetMapping("/{name}/statistics")
    public ***REMOVED***Statistics statistics(@PathVariable String name) {
        return ***REMOVED***Service.statistics(name);
    }
}
