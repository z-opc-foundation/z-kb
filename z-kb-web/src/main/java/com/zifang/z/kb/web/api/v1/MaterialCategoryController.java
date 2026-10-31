package com.zifang.z.kb.web.api.v1;

import com.zifang.z.kb.api.material.MaterialCategoryNode;
import com.zifang.z.kb.api.material.MaterialCategoryService;
import com.zifang.z.kb.protocol.response.KbResult;
import com.zifang.z.kb.web.api.v1.dto.CategoryAddRequest;
import com.zifang.z.kb.web.api.v1.dto.CategoryIdRequest;
import com.zifang.z.kb.web.api.v1.dto.CategoryMoveRequest;
import com.zifang.z.kb.web.api.v1.dto.CategoryUpdateRequest;
import com.zifang.z.kb.web.caller.KbCallerResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 物料分类 REST API（路径与语义对齐参考实现）。
 */
@Tag(name = "物料-分类")
@RestController
@RequestMapping("/api/kb/v1/materialCategory")
public class MaterialCategoryController {

    private final MaterialCategoryService categoryService;
    private final KbCallerResolver callerResolver;

    public MaterialCategoryController(MaterialCategoryService categoryService,
                                      KbCallerResolver callerResolver) {
        this.categoryService = categoryService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "分类树")
    @GetMapping("/tree")
    public KbResult<List<MaterialCategoryNode>> tree(@RequestParam String kbId,
                                                     HttpServletRequest request) {
        return KbResult.ok(categoryService.tree(kbId, callerResolver.resolve(request)));
    }

    @Operation(summary = "新建分类")
    @PostMapping("/add")
    public KbResult<MaterialCategoryNode> add(@RequestBody CategoryAddRequest body,
                                              HttpServletRequest request) {
        return KbResult.ok(categoryService.add(body.getKbId(), body.getParentId(),
                body.getName(), callerResolver.resolve(request)));
    }

    @Operation(summary = "重命名分类")
    @PostMapping("/update")
    public KbResult<Boolean> update(@RequestBody CategoryUpdateRequest body,
                                    HttpServletRequest request) {
        return KbResult.ok(categoryService.update(body.getCategoryId(), body.getName(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "移动分类")
    @PostMapping("/move")
    public KbResult<Boolean> move(@RequestBody CategoryMoveRequest body,
                                  HttpServletRequest request) {
        return KbResult.ok(categoryService.move(body.getCategoryId(), body.getParentId(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "删除分类")
    @PostMapping("/remove")
    public KbResult<Boolean> remove(@RequestBody CategoryIdRequest body,
                                    HttpServletRequest request) {
        return KbResult.ok(categoryService.remove(body.getCategoryId(),
                callerResolver.resolve(request)));
    }
}
