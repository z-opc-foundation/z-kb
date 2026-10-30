package com.zifang.z.***REMOVED***.web.controller;

import com.zifang.z.***REMOVED***.api.Document;
import com.zifang.z.***REMOVED***.api.ImportResult;
import com.zifang.z.***REMOVED***.api.IndexRequest;
import com.zifang.z.***REMOVED***.api.KnowledgeBaseService;
import com.zifang.z.***REMOVED***.protocol.request.ImportMarkdownRequest;
import com.zifang.z.***REMOVED***.protocol.response.CountResponse;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.web.bind.annotation.*;

import jakarta.annotation.Resource;
import java.util.List;

/**
 * 文档管理 REST API。
 */
@Api(tags = "文档管理")
@RestController
@RequestMapping("/api/***REMOVED***/documents")
public class DocumentController {

    @Resource
    private KnowledgeBaseService ***REMOVED***Service;

    @ApiOperation("索引单篇文档")
    @PostMapping
    public ImportResult index(@RequestBody IndexRequest request) {
        return ***REMOVED***Service.indexDocument(request);
    }

    @ApiOperation("批量索引")
    @PostMapping("/batch")
    public List<ImportResult> indexBatch(@RequestBody List<IndexRequest> requests) {
        return ***REMOVED***Service.indexBatch(requests);
    }

    @ApiOperation("导入 Markdown 文本")
    @PostMapping("/markdown")
    public ImportResult importMarkdown(@RequestBody ImportMarkdownRequest body) {
        return ***REMOVED***Service.importMarkdown(body.getWorkspace(), body.getTitle(), body.getContent(),
                body.getTags(), body.getAuthor());
    }

    @ApiOperation("查询文档")
    @GetMapping("/{workspace}/{id}")
    public Document get(@PathVariable String workspace, @PathVariable String id) {
        return ***REMOVED***Service.getDocument(workspace, id);
    }

    @ApiOperation("删除文档")
    @DeleteMapping("/{workspace}/{id}")
    public boolean delete(@PathVariable String workspace, @PathVariable String id) {
        return ***REMOVED***Service.deleteDocument(workspace, id);
    }

    @ApiOperation("列出文档")
    @GetMapping("/{workspace}")
    public List<Document> list(@PathVariable String workspace,
                                @RequestParam(defaultValue = "0") int offset,
                                @RequestParam(defaultValue = "20") int limit) {
        return ***REMOVED***Service.listDocuments(workspace, offset, limit);
    }

    @ApiOperation("按标签筛选")
    @GetMapping("/{workspace}/by-tags")
    public List<Document> listByTags(@PathVariable String workspace,
                                       @RequestParam List<String> tags,
                                       @RequestParam(defaultValue = "0") int offset,
                                       @RequestParam(defaultValue = "20") int limit) {
        return ***REMOVED***Service.listDocumentsByTags(workspace, tags, offset, limit);
    }

    @ApiOperation("重建索引")
    @PostMapping("/{workspace}/{id}/reindex")
    public ImportResult reindex(@PathVariable String workspace, @PathVariable String id) {
        return ***REMOVED***Service.reindex(workspace, id);
    }

    @ApiOperation("统计")
    @GetMapping("/{workspace}/count")
    public CountResponse count(@PathVariable String workspace) {
        return new CountResponse(***REMOVED***Service.countDocuments(workspace));
    }
}
