package com.zifang.z.kb.web.controller;

import com.zifang.z.kb.api.KBStatistics;
import com.zifang.z.kb.api.KnowledgeBaseService;
import com.zifang.z.kb.api.Workspace;
import com.zifang.z.kb.protocol.request.CreateWorkspaceRequest;
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
@RequestMapping("/api/kb/workspaces")
public class WorkspaceController {

    @Resource
    private KnowledgeBaseService kbService;

    @Operation(summary = "创建工作台")
    @PostMapping
    public Workspace create(@RequestBody CreateWorkspaceRequest body) {
        return kbService.createWorkspace(body.getName(), body.getDescription());
    }

    @Operation(summary = "按名称查询工作台")
    @GetMapping("/{name}")
    public Workspace get(@PathVariable String name) {
        return kbService.getWorkspace(name);
    }

    @Operation(summary = "列出所有工作台")
    @GetMapping
    public List<Workspace> list() {
        return kbService.listWorkspaces();
    }

    @Operation(summary = "工作台综合统计")
    @GetMapping("/{name}/statistics")
    public KBStatistics statistics(@PathVariable String name) {
        return kbService.statistics(name);
    }
}
