package com.zifang.z.kb.web.api.v1;

import com.zifang.z.kb.api.graph.GraphService;
import com.zifang.z.kb.api.graph.GraphView;
import com.zifang.z.kb.protocol.response.KbResult;
import com.zifang.z.kb.web.caller.KbCallerResolver;
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
@RestController
@RequestMapping("/api/kb/v1/graph")
public class GraphController {

    private final GraphService graphService;
    private final KbCallerResolver callerResolver;

    public GraphController(GraphService graphService, KbCallerResolver callerResolver) {
        this.graphService = graphService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "按知识库查询图谱",
            description = "节点按名称、边按标识稳定排序，各上限 200 条；可传 materialId 收窄证据资料")
    @GetMapping("/queryByKb")
    public KbResult<GraphView> queryByKb(@RequestParam String kbId,
                                         @RequestParam(required = false) String materialId,
                                         HttpServletRequest request) {
        return KbResult.ok(graphService.queryByKb(kbId, materialId,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "按物料查询图谱", description = "只返回以该物料为证据资料的节点与边")
    @GetMapping("/queryByMaterial")
    public KbResult<GraphView> queryByMaterial(@RequestParam String materialId,
                                               HttpServletRequest request) {
        return KbResult.ok(graphService.queryByMaterial(materialId,
                callerResolver.resolve(request)));
    }
}
