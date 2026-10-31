package com.zifang.z.***REMOVED***.web.api.v1;

import com.zifang.z.***REMOVED***.api.material.MaterialCategoryNode;
import com.zifang.z.***REMOVED***.api.material.MaterialCategoryService;
import com.zifang.z.***REMOVED***.protocol.response.***REMOVED***Result;
import com.zifang.z.***REMOVED***.web.api.v1.dto.CategoryAddRequest;
import com.zifang.z.***REMOVED***.web.api.v1.dto.CategoryIdRequest;
import com.zifang.z.***REMOVED***.web.api.v1.dto.CategoryMoveRequest;
import com.zifang.z.***REMOVED***.web.api.v1.dto.CategoryUpdateRequest;
import com.zifang.z.***REMOVED***.web.caller.***REMOVED***CallerResolver;
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
@RequestMapping("/api/***REMOVED***/v1/materialCategory")
public class MaterialCategoryController {

    private final MaterialCategoryService categoryService;
    private final ***REMOVED***CallerResolver callerResolver;

    public MaterialCategoryController(MaterialCategoryService categoryService,
                                      ***REMOVED***CallerResolver callerResolver) {
        this.categoryService = categoryService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "分类树")
    @GetMapping("/tree")
    public ***REMOVED***Result<List<MaterialCategoryNode>> tree(@RequestParam String ***REMOVED***Id,
                                                     HttpServletRequest request) {
        return ***REMOVED***Result.ok(categoryService.tree(***REMOVED***Id, callerResolver.resolve(request)));
    }

    @Operation(summary = "新建分类")
    @PostMapping("/add")
    public ***REMOVED***Result<MaterialCategoryNode> add(@RequestBody CategoryAddRequest body,
                                              HttpServletRequest request) {
        return ***REMOVED***Result.ok(categoryService.add(body.get***REMOVED***Id(), body.getParentId(),
                body.getName(), callerResolver.resolve(request)));
    }

    @Operation(summary = "重命名分类")
    @PostMapping("/update")
    public ***REMOVED***Result<Boolean> update(@RequestBody CategoryUpdateRequest body,
                                    HttpServletRequest request) {
        return ***REMOVED***Result.ok(categoryService.update(body.getCategoryId(), body.getName(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "移动分类")
    @PostMapping("/move")
    public ***REMOVED***Result<Boolean> move(@RequestBody CategoryMoveRequest body,
                                  HttpServletRequest request) {
        return ***REMOVED***Result.ok(categoryService.move(body.getCategoryId(), body.getParentId(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "删除分类")
    @PostMapping("/remove")
    public ***REMOVED***Result<Boolean> remove(@RequestBody CategoryIdRequest body,
                                    HttpServletRequest request) {
        return ***REMOVED***Result.ok(categoryService.remove(body.getCategoryId(),
                callerResolver.resolve(request)));
    }
}
