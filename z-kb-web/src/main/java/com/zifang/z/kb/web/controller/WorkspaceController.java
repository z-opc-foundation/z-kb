package com.zifang.z.kb.web.controller;

import com.zifang.z.kb.api.KBStatistics;
import com.zifang.z.kb.api.KnowledgeBaseService;
import com.zifang.z.kb.api.Workspace;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.List;
import java.util.Map;

/**
 * 工作台 REST API。
 */
@Api(tags = "工作台")
@RestController
@RequestMapping("/api/kb/workspaces")
public class WorkspaceController {

    @Resource
    private KnowledgeBaseService kbService;

    @ApiOperation("创建工作台")
    @PostMapping
    public Workspace create(@RequestBody Map<String, String> body) {
        return kbService.createWorkspace(body.get("name"), body.get("description"));
    }

    @ApiOperation("按名称查询工作台")
    @GetMapping("/{name}")
    public Workspace get(@PathVariable String name) {
        return kbService.getWorkspace(name);
    }

    @ApiOperation("列出所有工作台")
    @GetMapping
    public List<Workspace> list() {
        return kbService.listWorkspaces();
    }

    @ApiOperation("工作台综合统计")
    @GetMapping("/{name}/statistics")
    public KBStatistics statistics(@PathVariable String name) {
        return kbService.statistics(name);
    }
}
