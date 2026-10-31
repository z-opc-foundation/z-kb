package com.zifang.z.***REMOVED***.web.api.v1;

import com.zifang.z.***REMOVED***.api.***REMOVED***Exception;
import com.zifang.z.***REMOVED***.api.material.MaterialAttachment;
import com.zifang.z.***REMOVED***.api.material.MaterialBatchItem;
import com.zifang.z.***REMOVED***.api.material.MaterialDetail;
import com.zifang.z.***REMOVED***.api.material.MaterialDownload;
import com.zifang.z.***REMOVED***.api.material.MaterialService;
import com.zifang.z.***REMOVED***.api.material.MaterialUploadFile;
import com.zifang.z.***REMOVED***.api.material.MaterialUploadItem;
import com.zifang.z.***REMOVED***.api.material.MaterialView;
import com.zifang.z.***REMOVED***.api.material.ParsedDraftView;
import com.zifang.z.***REMOVED***.api.resource.PageResult;
import com.zifang.z.***REMOVED***.protocol.response.***REMOVED***Result;
import com.zifang.z.***REMOVED***.web.api.v1.dto.MaterialCategoryUpdateRequest;
import com.zifang.z.***REMOVED***.web.api.v1.dto.MaterialDraftSaveRequest;
import com.zifang.z.***REMOVED***.web.api.v1.dto.MaterialIdsRequest;
import com.zifang.z.***REMOVED***.web.api.v1.dto.MaterialPageRequest;
import com.zifang.z.***REMOVED***.web.api.v1.dto.MaterialReparseRequest;
import com.zifang.z.***REMOVED***.web.api.v1.dto.MaterialTextRegisterRequest;
import com.zifang.z.***REMOVED***.web.api.v1.dto.MaterialUrlRegisterRequest;
import com.zifang.z.***REMOVED***.web.caller.***REMOVED***CallerResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * 物料 REST API（路径与语义对齐参考实现）。
 */
@Tag(name = "物料")
@RestController
@RequestMapping("/api/***REMOVED***/v1/material")
public class MaterialController {

    private final MaterialService materialService;
    private final ***REMOVED***CallerResolver callerResolver;

    public MaterialController(MaterialService materialService, ***REMOVED***CallerResolver callerResolver) {
        this.materialService = materialService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "物料分页列表")
    @PostMapping("/page")
    public ***REMOVED***Result<PageResult<MaterialView>> page(
            @RequestBody(required = false) MaterialPageRequest body, HttpServletRequest request) {
        MaterialPageRequest query = body == null ? new MaterialPageRequest() : body;
        return ***REMOVED***Result.ok(materialService.page(query.get***REMOVED***Id(), query.toQuery(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "上传并登记物料")
    @PostMapping("/upload")
    public ***REMOVED***Result<List<MaterialUploadItem>> upload(
            @RequestParam String ***REMOVED***Id,
            @RequestParam(required = false) String categoryId,
            @RequestParam("files") MultipartFile[] files,
            HttpServletRequest request) {
        List<MaterialUploadFile> items = new ArrayList<>();
        for (MultipartFile file : files) {
            items.add(toUploadFile(file));
        }
        return ***REMOVED***Result.ok(materialService.upload(***REMOVED***Id, categoryId, items,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "物料详情")
    @GetMapping("/queryDetailById")
    public ***REMOVED***Result<MaterialDetail> queryDetailById(@RequestParam String materialId,
                                                    HttpServletRequest request) {
        return ***REMOVED***Result.ok(materialService.detail(materialId, callerResolver.resolve(request)));
    }

    @Operation(summary = "最近登记资料")
    @GetMapping("/listRecent")
    public ***REMOVED***Result<List<MaterialView>> listRecent(
            @RequestParam String ***REMOVED***Id,
            @RequestParam(required = false, defaultValue = "5") int limit,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(materialService.listRecent(***REMOVED***Id, limit,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "批量调整分类")
    @PostMapping("/updateCategory")
    public ***REMOVED***Result<List<MaterialBatchItem>> updateCategory(
            @RequestBody MaterialCategoryUpdateRequest body, HttpServletRequest request) {
        return ***REMOVED***Result.ok(materialService.updateCategory(body.get***REMOVED***Id(), body.getMaterialIds(),
                body.getCategoryId(), callerResolver.resolve(request)));
    }

    @Operation(summary = "批量删除物料")
    @PostMapping("/remove")
    public ***REMOVED***Result<List<MaterialBatchItem>> remove(@RequestBody MaterialIdsRequest body,
                                                    HttpServletRequest request) {
        return ***REMOVED***Result.ok(materialService.remove(body.get***REMOVED***Id(), body.getMaterialIds(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "下载物料原件")
    @GetMapping("/download")
    public void download(@RequestParam String materialId,
                         @RequestParam(required = false) String versionId,
                         HttpServletRequest request,
                         HttpServletResponse response) throws IOException {
        MaterialDownload download = materialService.download(materialId, versionId,
                callerResolver.resolve(request));
        byte[] content = download.getContent();
        response.setContentType(MediaType.APPLICATION_OCTET_STREAM_VALUE);
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                .filename(download.getFileName(), StandardCharsets.UTF_8).build().toString());
        response.setContentLength(content.length);
        response.getOutputStream().write(content);
        response.flushBuffer();
    }

    @Operation(summary = "上传新版本")
    @PostMapping("/revise")
    public ***REMOVED***Result<MaterialUploadItem> revise(
            @RequestParam String ***REMOVED***Id,
            @RequestParam String materialId,
            @RequestParam(required = false) String sourceVersion,
            @RequestParam("file") MultipartFile file,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(materialService.revise(***REMOVED***Id, materialId, toUploadFile(file),
                sourceVersion, callerResolver.resolve(request)));
    }

    @Operation(summary = "重新解析物料")
    @PostMapping("/reparse")
    public ***REMOVED***Result<ParsedDraftView> reparse(@RequestBody MaterialReparseRequest body,
                                             HttpServletRequest request) {
        return ***REMOVED***Result.ok(materialService.reparse(body.getMaterialId(), body.getVersionId(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "批量恢复物料")
    @PostMapping("/restore")
    public ***REMOVED***Result<List<MaterialBatchItem>> restore(@RequestBody MaterialIdsRequest body,
                                                     HttpServletRequest request) {
        return ***REMOVED***Result.ok(materialService.restore(body.get***REMOVED***Id(), body.getMaterialIds(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "回收站分页")
    @PostMapping("/pageDeleted")
    public ***REMOVED***Result<PageResult<MaterialView>> pageDeleted(
            @RequestBody MaterialPageRequest body, HttpServletRequest request) {
        return ***REMOVED***Result.ok(materialService.pageDeleted(body.get***REMOVED***Id(), body.getKeyword(),
                body.getCurrent(), body.getSize(), callerResolver.resolve(request)));
    }

    @Operation(summary = "彻底删除物料")
    @PostMapping("/purge")
    public ***REMOVED***Result<List<MaterialBatchItem>> purge(@RequestBody MaterialIdsRequest body,
                                                   HttpServletRequest request) {
        return ***REMOVED***Result.ok(materialService.purge(body.get***REMOVED***Id(), body.getMaterialIds(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "解析稿列表")
    @GetMapping("/listDrafts")
    public ***REMOVED***Result<List<ParsedDraftView>> listDrafts(
            @RequestParam String materialId,
            @RequestParam(required = false) String versionId,
            HttpServletRequest request) {
        return ***REMOVED***Result.ok(materialService.listDrafts(materialId, versionId,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "保存解析稿正文")
    @PostMapping("/saveDraftText")
    public ***REMOVED***Result<ParsedDraftView> saveDraftText(@RequestBody MaterialDraftSaveRequest body,
                                                   HttpServletRequest request) {
        return ***REMOVED***Result.ok(materialService.saveDraftText(body.getMaterialId(), body.getVersionId(),
                body.getTextContent(), callerResolver.resolve(request)));
    }

    @Operation(summary = "上传会话附件")
    @PostMapping("/attachment")
    public ***REMOVED***Result<MaterialAttachment> attachment(
            @RequestParam(required = false) String ***REMOVED***Id,
            @RequestParam("file") MultipartFile file,
            HttpServletRequest request) throws IOException {
        return ***REMOVED***Result.ok(materialService.uploadAttachment(***REMOVED***Id, file.getOriginalFilename(),
                file.getBytes(), callerResolver.resolve(request)));
    }

    @Operation(summary = "文本登记为资料")
    @PostMapping("/registerText")
    public ***REMOVED***Result<MaterialUploadItem> registerText(
            @RequestBody MaterialTextRegisterRequest body, HttpServletRequest request) {
        return ***REMOVED***Result.ok(materialService.registerText(body.get***REMOVED***Id(), body.getTitle(),
                body.getCategoryId(), body.getContent(), callerResolver.resolve(request)));
    }

    @Operation(summary = "按附件地址登记资料")
    @PostMapping("/registerFromUrl")
    public ***REMOVED***Result<MaterialUploadItem> registerFromUrl(
            @RequestBody MaterialUrlRegisterRequest body, HttpServletRequest request) {
        return ***REMOVED***Result.ok(materialService.registerFromUrl(body.get***REMOVED***Id(), body.getTitle(),
                body.getFileName(), body.getCategoryId(), body.getUrl(),
                callerResolver.resolve(request)));
    }

    private static MaterialUploadFile toUploadFile(MultipartFile file) {
        try {
            return new MaterialUploadFile(file.getOriginalFilename(), file.getSize(),
                    file.getBytes());
        } catch (IOException e) {
            throw new ***REMOVED***Exception("MATERIAL_FILE_EMPTY", "读取上传文件失败：" + e.getMessage(), e);
        }
    }
}
