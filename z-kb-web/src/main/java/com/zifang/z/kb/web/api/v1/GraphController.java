package com.zifang.z.***REMOVED***.web.api.v1;

import com.zifang.z.***REMOVED***.api.graph.GraphService;
import com.zifang.z.***REMOVED***.api.graph.GraphView;
import com.zifang.z.***REMOVED***.protocol.response.***REMOVED***Result;
import com.zifang.z.***REMOVED***.web.caller.***REMOVED***CallerResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 本地规则图谱 REST API（路径与语义对齐参考实现）。
 */
@Tag(name = "本地规则图谱")
@RestController("***REMOVED***GraphV1Controller")
@RequestMapping("/api/***REMOVED***/v1/graph")
public class GraphController {

    private final GraphService graphService;
    private final ***REMOVED***CallerResolver callerResolver;

    public GraphController(GraphService graphService, ***REMOVED***CallerResolver callerResolver) {
        this.graphService = graphService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "按知识库查询图谱",
            description = "节点按名称、边按标识稳定排序，各上限 200 条；可传 materialId 收窄证据资料")
    @GetMapping("/queryBy***REMOVED***")
    public ***REMOVED***Result<GraphView> queryBy***REMOVED***(@RequestParam String ***REMOVED***Id,
                                         @RequestParam(required = false) String materialId,
                                         HttpServletRequest request) {
        return ***REMOVED***Result.ok(graphService.queryBy***REMOVED***(***REMOVED***Id, materialId,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "按物料查询图谱", description = "只返回以该物料为证据资料的节点与边")
    @GetMapping("/queryByMaterial")
    public ***REMOVED***Result<GraphView> queryByMaterial(@RequestParam String materialId,
                                               HttpServletRequest request) {
        return ***REMOVED***Result.ok(graphService.queryByMaterial(materialId,
                callerResolver.resolve(request)));
    }
}
