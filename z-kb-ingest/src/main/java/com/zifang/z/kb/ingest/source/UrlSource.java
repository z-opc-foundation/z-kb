package com.zifang.z.kb.ingest.source;

import com.zifang.z.kb.ingest.api.DataSource;
import com.zifang.z.kb.ingest.api.DataSourceType;
import com.zifang.z.kb.ingest.api.IngestRequest;
import com.zifang.z.kb.ingest.util.HtmlToMarkdown;
import com.zifang.z.kb.ingest.util.HttpHelper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

/**
 * 远程 URL 数据源 — HTTP 抓取任意公开页面，转 Markdown 后入知识库。
 *
 * <p>必填 config：
 * <ul>
 *   <li>{@code url}：目标 URL</li>
 * </ul>
 *
 * <p>可选 config：
 * <ul>
 *   <li>{@code workspace}：目标工作台</li>
 *   <li>{@code title}：强制覆盖标题（否则用 &lt;title&gt; 或 URL）</li>
 *   <li>{@code tagSelectors}：CSS 选择器，过滤掉 nav/footer/script 等（用伪实现 — 简单字符串替换）</li>
 * </ul>
 */
public class UrlSource implements DataSource {

    private static final Logger log = LoggerFactory.getLogger(UrlSource.class);

    private final String sourceId;

    public UrlSource(String sourceId) {
        this.sourceId = sourceId;
    }

    public UrlSource() {
        this("url-default");
    }

    @Override
    public String getSourceId() { return sourceId; }

    @Override
    public DataSourceType getType() { return DataSourceType.URL; }

    @Override
    public List<IngestRequest> fetch(Map<String, Object> config) throws Exception {
        String url = (String) config.get("url");
        if (url == null || url.isEmpty()) throw new IllegalArgumentException("url 不能为空");

        String workspace = (String) config.getOrDefault("workspace", "default");
        String forcedTitle = (String) config.get("title");

        Map<String, String> headers = new HashMap<>();
        headers.put("User-Agent", "Mozilla/5.0 (z-kb/1.0) KnowledgeBot");
        headers.put("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9");

        HttpHelper.Response resp = HttpHelper.get(url, headers);
        if (!resp.is2xx()) {
            throw new RuntimeException("URL 抓取失败 HTTP " + resp.status + " - " + url);
        }
        String html = resp.body;

        String title = forcedTitle;
        if (title == null || title.isEmpty()) {
            title = extractTitle(html);
        }
        if (title == null || title.isEmpty()) {
            title = url;
        }

        String markdown = HtmlToMarkdown.convert(html);

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("url", url);
        meta.put("fetchedAt", System.currentTimeMillis());
        meta.put("contentLength", html.length());
        meta.put("source", "url");

        IngestRequest req = IngestRequest.builder()
                .id("url:" + url)
                .sourceType(DataSourceType.URL)
                .sourceId(sourceId)
                .content(markdown)
                .contentType("text/markdown")
                .workspace(workspace)
                .title(title)
                .sourceUrl(url)
                .category("url")
                .metadata(meta)
                .build();

        log.info("UrlSource [{}] 抓取 {} chars from {}", sourceId, markdown.length(), url);
        return List.of(req);
    }

    private String extractTitle(String html) {
        int idx = html.toLowerCase().indexOf("<title");
        if (idx < 0) return null;
        int end = html.toLowerCase().indexOf("</title>", idx);
        if (end < 0) return null;
        int start = html.indexOf('>', idx) + 1;
        String t = html.substring(start, end).trim();
        // 简单去除空白
        return t.replaceAll("\\s+", " ");
    }
}