package com.zifang.z.kb.web.controller;

import com.zifang.z.kb.api.Entity;
import com.zifang.z.kb.api.GraphQueryResult;
import com.zifang.z.kb.api.KnowledgeBaseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import jakarta.annotation.Resource;
import java.util.List;

/**
 * 知识图谱 REST API。
 */
@Tag(name = "知识图谱")
@RestController
@RequestMapping("/api/kb/graph")
public class GraphController {

    @Resource
    private KnowledgeBaseService kbService;

    @Operation(summary = "列出全部实体")
    @GetMapping("/{workspace}/entities")
    public List<Entity> listEntities(@PathVariable String workspace,
                                       @RequestParam(defaultValue = "100") int limit) {
        return kbService.listEntities(workspace, limit);
    }

    @Operation(summary = "按名称查询实体")
    @GetMapping("/{workspace}/entities/{name}")
    public Entity getEntity(@PathVariable String workspace, @PathVariable String name) {
        return kbService.getEntity(workspace, name);
    }

    @Operation(summary = "实体的邻居")
    @GetMapping("/{workspace}/entities/{name}/neighbors")
    public List<Entity> getNeighbors(@PathVariable String workspace, @PathVariable String name,
                                       @RequestParam(defaultValue = "2") int depth) {
        return kbService.getNeighbors(workspace, name, depth);
    }

    @Operation(summary = "子图查询")
    @PostMapping("/{workspace}/subgraph")
    public GraphQueryResult getSubgraph(@PathVariable String workspace, @RequestBody List<String> entityNames,
                                          @RequestParam(defaultValue = "2") int depth) {
        return kbService.getSubgraph(workspace, entityNames, depth);
    }
}
