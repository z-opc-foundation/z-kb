package com.zifang.z.kb.web.controller;

import com.zifang.z.kb.api.Document;
import com.zifang.z.kb.api.ImportResult;
import com.zifang.z.kb.api.IndexRequest;
import com.zifang.z.kb.api.KnowledgeBaseService;
import com.zifang.z.kb.protocol.request.ImportMarkdownRequest;
import com.zifang.z.kb.protocol.response.CountResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import jakarta.annotation.Resource;
import java.util.List;

/**
 * 文档管理 REST API。
 */
@Tag(name = "文档管理")
@RestController
@RequestMapping("/api/kb/documents")
public class DocumentController {

    @Resource
    private KnowledgeBaseService kbService;

    @Operation(summary = "索引单篇文档")
    @PostMapping
    public ImportResult index(@RequestBody IndexRequest request) {
        return kbService.indexDocument(request);
    }

    @Operation(summary = "批量索引")
    @PostMapping("/batch")
    public List<ImportResult> indexBatch(@RequestBody List<IndexRequest> requests) {
        return kbService.indexBatch(requests);
    }

    @Operation(summary = "导入 Markdown 文本")
    @PostMapping("/markdown")
    public ImportResult importMarkdown(@RequestBody ImportMarkdownRequest body) {
        return kbService.importMarkdown(body.getWorkspace(), body.getTitle(), body.getContent(),
                body.getTags(), body.getAuthor());
    }

    @Operation(summary = "查询文档")
    @GetMapping("/{workspace}/{id}")
    public Document get(@PathVariable String workspace, @PathVariable String id) {
        return kbService.getDocument(workspace, id);
    }

    @Operation(summary = "删除文档")
    @DeleteMapping("/{workspace}/{id}")
    public boolean delete(@PathVariable String workspace, @PathVariable String id) {
        return kbService.deleteDocument(workspace, id);
    }

    @Operation(summary = "列出文档")
    @GetMapping("/{workspace}")
    public List<Document> list(@PathVariable String workspace,
                                @RequestParam(defaultValue = "0") int offset,
                                @RequestParam(defaultValue = "20") int limit) {
        return kbService.listDocuments(workspace, offset, limit);
    }

    @Operation(summary = "按标签筛选")
    @GetMapping("/{workspace}/by-tags")
    public List<Document> listByTags(@PathVariable String workspace,
                                       @RequestParam List<String> tags,
                                       @RequestParam(defaultValue = "0") int offset,
                                       @RequestParam(defaultValue = "20") int limit) {
        return kbService.listDocumentsByTags(workspace, tags, offset, limit);
    }

    @Operation(summary = "重建索引")
    @PostMapping("/{workspace}/{id}/reindex")
    public ImportResult reindex(@PathVariable String workspace, @PathVariable String id) {
        return kbService.reindex(workspace, id);
    }

    @Operation(summary = "统计")
    @GetMapping("/{workspace}/count")
    public CountResponse count(@PathVariable String workspace) {
        return new CountResponse(kbService.countDocuments(workspace));
    }
}
