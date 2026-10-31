package com.zifang.z.kb.web.api.v1;

import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.material.MaterialAttachment;
import com.zifang.z.kb.api.material.MaterialBatchItem;
import com.zifang.z.kb.api.material.MaterialDetail;
import com.zifang.z.kb.api.material.MaterialDownload;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.material.MaterialUploadFile;
import com.zifang.z.kb.api.material.MaterialUploadItem;
import com.zifang.z.kb.api.material.MaterialView;
import com.zifang.z.kb.api.material.ParsedDraftView;
import com.zifang.z.kb.api.resource.PageResult;
import com.zifang.z.kb.protocol.response.KbResult;
import com.zifang.z.kb.web.api.v1.dto.MaterialCategoryUpdateRequest;
import com.zifang.z.kb.web.api.v1.dto.MaterialDraftSaveRequest;
import com.zifang.z.kb.web.api.v1.dto.MaterialIdsRequest;
import com.zifang.z.kb.web.api.v1.dto.MaterialPageRequest;
import com.zifang.z.kb.web.api.v1.dto.MaterialReparseRequest;
import com.zifang.z.kb.web.api.v1.dto.MaterialTextRegisterRequest;
import com.zifang.z.kb.web.api.v1.dto.MaterialUrlRegisterRequest;
import com.zifang.z.kb.web.caller.KbCallerResolver;
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
@RequestMapping("/api/kb/v1/material")
public class MaterialController {

    private final MaterialService materialService;
    private final KbCallerResolver callerResolver;

    public MaterialController(MaterialService materialService, KbCallerResolver callerResolver) {
        this.materialService = materialService;
        this.callerResolver = callerResolver;
    }

    @Operation(summary = "物料分页列表")
    @PostMapping("/page")
    public KbResult<PageResult<MaterialView>> page(
            @RequestBody(required = false) MaterialPageRequest body, HttpServletRequest request) {
        MaterialPageRequest query = body == null ? new MaterialPageRequest() : body;
        return KbResult.ok(materialService.page(query.getKbId(), query.toQuery(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "上传并登记物料")
    @PostMapping("/upload")
    public KbResult<List<MaterialUploadItem>> upload(
            @RequestParam String kbId,
            @RequestParam(required = false) String categoryId,
            @RequestParam("files") MultipartFile[] files,
            HttpServletRequest request) {
        List<MaterialUploadFile> items = new ArrayList<>();
        for (MultipartFile file : files) {
            items.add(toUploadFile(file));
        }
        return KbResult.ok(materialService.upload(kbId, categoryId, items,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "物料详情")
    @GetMapping("/queryDetailById")
    public KbResult<MaterialDetail> queryDetailById(@RequestParam String materialId,
                                                    HttpServletRequest request) {
        return KbResult.ok(materialService.detail(materialId, callerResolver.resolve(request)));
    }

    @Operation(summary = "最近登记资料")
    @GetMapping("/listRecent")
    public KbResult<List<MaterialView>> listRecent(
            @RequestParam String kbId,
            @RequestParam(required = false, defaultValue = "5") int limit,
            HttpServletRequest request) {
        return KbResult.ok(materialService.listRecent(kbId, limit,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "批量调整分类")
    @PostMapping("/updateCategory")
    public KbResult<List<MaterialBatchItem>> updateCategory(
            @RequestBody MaterialCategoryUpdateRequest body, HttpServletRequest request) {
        return KbResult.ok(materialService.updateCategory(body.getKbId(), body.getMaterialIds(),
                body.getCategoryId(), callerResolver.resolve(request)));
    }

    @Operation(summary = "批量删除物料")
    @PostMapping("/remove")
    public KbResult<List<MaterialBatchItem>> remove(@RequestBody MaterialIdsRequest body,
                                                    HttpServletRequest request) {
        return KbResult.ok(materialService.remove(body.getKbId(), body.getMaterialIds(),
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
    public KbResult<MaterialUploadItem> revise(
            @RequestParam String kbId,
            @RequestParam String materialId,
            @RequestParam(required = false) String sourceVersion,
            @RequestParam("file") MultipartFile file,
            HttpServletRequest request) {
        return KbResult.ok(materialService.revise(kbId, materialId, toUploadFile(file),
                sourceVersion, callerResolver.resolve(request)));
    }

    @Operation(summary = "重新解析物料")
    @PostMapping("/reparse")
    public KbResult<ParsedDraftView> reparse(@RequestBody MaterialReparseRequest body,
                                             HttpServletRequest request) {
        return KbResult.ok(materialService.reparse(body.getMaterialId(), body.getVersionId(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "批量恢复物料")
    @PostMapping("/restore")
    public KbResult<List<MaterialBatchItem>> restore(@RequestBody MaterialIdsRequest body,
                                                     HttpServletRequest request) {
        return KbResult.ok(materialService.restore(body.getKbId(), body.getMaterialIds(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "回收站分页")
    @PostMapping("/pageDeleted")
    public KbResult<PageResult<MaterialView>> pageDeleted(
            @RequestBody MaterialPageRequest body, HttpServletRequest request) {
        return KbResult.ok(materialService.pageDeleted(body.getKbId(), body.getKeyword(),
                body.getCurrent(), body.getSize(), callerResolver.resolve(request)));
    }

    @Operation(summary = "彻底删除物料")
    @PostMapping("/purge")
    public KbResult<List<MaterialBatchItem>> purge(@RequestBody MaterialIdsRequest body,
                                                   HttpServletRequest request) {
        return KbResult.ok(materialService.purge(body.getKbId(), body.getMaterialIds(),
                callerResolver.resolve(request)));
    }

    @Operation(summary = "解析稿列表")
    @GetMapping("/listDrafts")
    public KbResult<List<ParsedDraftView>> listDrafts(
            @RequestParam String materialId,
            @RequestParam(required = false) String versionId,
            HttpServletRequest request) {
        return KbResult.ok(materialService.listDrafts(materialId, versionId,
                callerResolver.resolve(request)));
    }

    @Operation(summary = "保存解析稿正文")
    @PostMapping("/saveDraftText")
    public KbResult<ParsedDraftView> saveDraftText(@RequestBody MaterialDraftSaveRequest body,
                                                   HttpServletRequest request) {
        return KbResult.ok(materialService.saveDraftText(body.getMaterialId(), body.getVersionId(),
                body.getTextContent(), callerResolver.resolve(request)));
    }

    @Operation(summary = "上传会话附件")
    @PostMapping("/attachment")
    public KbResult<MaterialAttachment> attachment(
            @RequestParam(required = false) String kbId,
            @RequestParam("file") MultipartFile file,
            HttpServletRequest request) throws IOException {
        return KbResult.ok(materialService.uploadAttachment(kbId, file.getOriginalFilename(),
                file.getBytes(), callerResolver.resolve(request)));
    }

    @Operation(summary = "文本登记为资料")
    @PostMapping("/registerText")
    public KbResult<MaterialUploadItem> registerText(
            @RequestBody MaterialTextRegisterRequest body, HttpServletRequest request) {
        return KbResult.ok(materialService.registerText(body.getKbId(), body.getTitle(),
                body.getCategoryId(), body.getContent(), callerResolver.resolve(request)));
    }

    @Operation(summary = "按附件地址登记资料")
    @PostMapping("/registerFromUrl")
    public KbResult<MaterialUploadItem> registerFromUrl(
            @RequestBody MaterialUrlRegisterRequest body, HttpServletRequest request) {
        return KbResult.ok(materialService.registerFromUrl(body.getKbId(), body.getTitle(),
                body.getFileName(), body.getCategoryId(), body.getUrl(),
                callerResolver.resolve(request)));
    }

    private static MaterialUploadFile toUploadFile(MultipartFile file) {
        try {
            return new MaterialUploadFile(file.getOriginalFilename(), file.getSize(),
                    file.getBytes());
        } catch (IOException e) {
            throw new KBException("MATERIAL_FILE_EMPTY", "读取上传文件失败：" + e.getMessage(), e);
        }
    }
}
