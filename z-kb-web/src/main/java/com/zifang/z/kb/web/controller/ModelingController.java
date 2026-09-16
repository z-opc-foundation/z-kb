package com.zifang.z.kb.web.controller;

import com.zifang.z.kb.modeling.core.ModelingService;
import com.zifang.z.kb.modeling.model.CheatSheet;
import com.zifang.z.kb.modeling.model.ProductModel;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

/**
 * 产品建模控制器 — 拆解知识库 → 生成产品小抄。
 *
 * <p>路径前缀：/api/kb/modeling
 */
@Api(tags = "产品建模")
@RestController
@RequestMapping("/api/kb/modeling")
public class ModelingController {

    @Autowired
    private ModelingService modelingService;

    @ApiOperation("拆解工作台下的全部文档为一个产品模型")
    @GetMapping("/decompose")
    public ProductModel decompose(@RequestParam(defaultValue = "default") String workspace) {
        return modelingService.decompose(workspace);
    }

    @ApiOperation("渲染 Markdown 小抄（基于已拆解的模型）")
    @PostMapping("/cheatsheet")
    public CheatSheet cheatsheet(@RequestBody ProductModel model) {
        return modelingService.generateCheatSheet(model);
    }

    @ApiOperation("一站式：拆解 + 渲染小抄")
    @GetMapping("/cheatsheet")
    public CheatSheet cheatsheetForWorkspace(@RequestParam(defaultValue = "default") String workspace) {
        return modelingService.generateCheatSheet(workspace);
    }
}