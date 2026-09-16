package com.zifang.z.***REMOVED***.web.controller;

import com.zifang.z.***REMOVED***.api.Entity;
import com.zifang.z.***REMOVED***.api.GraphQueryResult;
import com.zifang.z.***REMOVED***.api.KnowledgeBaseService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.List;

/**
 * 知识图谱 REST API。
 */
@Api(tags = "知识图谱")
@RestController
@RequestMapping("/api/***REMOVED***/graph")
public class GraphController {

    @Resource
    private KnowledgeBaseService ***REMOVED***Service;

    @ApiOperation("列出全部实体")
    @GetMapping("/{workspace}/entities")
    public List<Entity> listEntities(@PathVariable String workspace,
                                       @RequestParam(defaultValue = "100") int limit) {
        return ***REMOVED***Service.listEntities(workspace, limit);
    }

    @ApiOperation("按名称查询实体")
    @GetMapping("/{workspace}/entities/{name}")
    public Entity getEntity(@PathVariable String workspace, @PathVariable String name) {
        return ***REMOVED***Service.getEntity(workspace, name);
    }

    @ApiOperation("实体的邻居")
    @GetMapping("/{workspace}/entities/{name}/neighbors")
    public List<Entity> getNeighbors(@PathVariable String workspace, @PathVariable String name,
                                       @RequestParam(defaultValue = "2") int depth) {
        return ***REMOVED***Service.getNeighbors(workspace, name, depth);
    }

    @ApiOperation("子图查询")
    @PostMapping("/{workspace}/subgraph")
    public GraphQueryResult getSubgraph(@PathVariable String workspace, @RequestBody List<String> entityNames,
                                          @RequestParam(defaultValue = "2") int depth) {
        return ***REMOVED***Service.getSubgraph(workspace, entityNames, depth);
    }
}
