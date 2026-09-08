package com.zifang.z.kb.web.controller;

import com.zifang.z.kb.api.Document;
import com.zifang.z.kb.api.ImportResult;
import com.zifang.z.kb.api.IndexRequest;
import com.zifang.z.kb.api.KnowledgeBaseService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.List;
import java.util.Map;

/**
 * 文档管理 REST API。
 */
@Api(tags = "文档管理")
@RestController
@RequestMapping("/api/kb/documents")
public class DocumentController {

    @Resource
    private KnowledgeBaseService kbService;

    @ApiOperation("索引单篇文档")
    @PostMapping
    public ImportResult index(@RequestBody IndexRequest request) {
        return kbService.indexDocument(request);
    }

    @ApiOperation("批量索引")
    @PostMapping("/batch")
    public List<ImportResult> indexBatch(@RequestBody List<IndexRequest> requests) {
        return kbService.indexBatch(requests);
    }

    @ApiOperation("导入 Markdown 文本")
    @PostMapping("/markdown")
    public ImportResult importMarkdown(@RequestBody Map<String, Object> body) {
        String workspace = (String) body.getOrDefault("workspace", "default");
        String title = (String) body.get("title");
        String content = (String) body.get("content");
        @SuppressWarnings("unchecked")
        List<String> tags = (List<String>) body.get("tags");
        String author = (String) body.get("author");
        return kbService.importMarkdown(workspace, title, content, tags, author);
    }

    @ApiOperation("查询文档")
    @GetMapping("/{workspace}/{id}")
    public Document get(@PathVariable String workspace, @PathVariable String id) {
        return kbService.getDocument(workspace, id);
    }

    @ApiOperation("删除文档")
    @DeleteMapping("/{workspace}/{id}")
    public boolean delete(@PathVariable String workspace, @PathVariable String id) {
        return kbService.deleteDocument(workspace, id);
    }

    @ApiOperation("列出文档")
    @GetMapping("/{workspace}")
    public List<Document> list(@PathVariable String workspace,
                                @RequestParam(defaultValue = "0") int offset,
                                @RequestParam(defaultValue = "20") int limit) {
        return kbService.listDocuments(workspace, offset, limit);
    }

    @ApiOperation("按标签筛选")
    @GetMapping("/{workspace}/by-tags")
    public List<Document> listByTags(@PathVariable String workspace,
                                       @RequestParam List<String> tags,
                                       @RequestParam(defaultValue = "0") int offset,
                                       @RequestParam(defaultValue = "20") int limit) {
        return kbService.listDocumentsByTags(workspace, tags, offset, limit);
    }

    @ApiOperation("重建索引")
    @PostMapping("/{workspace}/{id}/reindex")
    public ImportResult reindex(@PathVariable String workspace, @PathVariable String id) {
        return kbService.reindex(workspace, id);
    }

    @ApiOperation("统计")
    @GetMapping("/{workspace}/count")
    public Map<String, Object> count(@PathVariable String workspace) {
        long c = kbService.countDocuments(workspace);
        return java.util.Collections.singletonMap("count", c);
    }
}
