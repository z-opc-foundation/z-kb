package com.zifang.z.kb.ingest.source;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zifang.z.kb.ingest.api.DataSource;
import com.zifang.z.kb.ingest.api.DataSourceType;
import com.zifang.z.kb.ingest.api.IngestRequest;
import com.zifang.z.kb.ingest.util.HtmlToMarkdown;
import com.zifang.z.kb.ingest.util.HttpHelper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Confluence 数据源 — 通过 Confluence REST API v1 拉取指定空间下的页面。
 *
 * <p>必填 config：
 * <ul>
 *   <li>{@code baseUrl}：例如 https://your-domain.atlassian.net/wiki</li>
 *   <li>{@code username}：账号邮箱</li>
 *   <li>{@code apiToken}：API token</li>
 *   <li>{@code spaceKey}：空间 KEY</li>
 * </ul>
 */
public class ConfluenceSource implements DataSource {

    private static final Logger log = LoggerFactory.getLogger(ConfluenceSource.class);

    private final String sourceId;
    private final ObjectMapper mapper = new ObjectMapper();

    public ConfluenceSource(String sourceId) {
        this.sourceId = sourceId;
    }

    public ConfluenceSource() {
        this("confluence-default");
    }

    @Override
    public String getSourceId() { return sourceId; }

    @Override
    public DataSourceType getType() { return DataSourceType.CONFLUENCE; }

    @Override
    public List<IngestRequest> fetch(Map<String, Object> config) throws Exception {
        String baseUrl = (String) config.get("baseUrl");
        String username = (String) config.get("username");
        String apiToken = (String) config.get("apiToken");
        String spaceKey = (String) config.get("spaceKey");
        if (baseUrl == null || username == null || apiToken == null || spaceKey == null) {
            throw new IllegalArgumentException("baseUrl / username / apiToken / spaceKey 必填");
        }
        String workspace = (String) config.getOrDefault("workspace", "default");
        int limit = (int) config.getOrDefault("limit", 50);

        String auth = Base64.getEncoder().encodeToString((username + ":" + apiToken).getBytes(StandardCharsets.UTF_8));
        Map<String, String> headers = new HashMap<>();
        headers.put("Authorization", "Basic " + auth);
        headers.put("Accept", "application/json");

        String encodedSpace = URLEncoder.encode(spaceKey, StandardCharsets.UTF_8);
        String cql = String.format("space=%s+AND+type=page", encodedSpace);
        String url = baseUrl + "/rest/api/content/search?cql=" + URLEncoder.encode(cql, StandardCharsets.UTF_8) + "&limit=" + limit + "&expand=body.storage";

        HttpHelper.Response resp = HttpHelper.get(url, headers);
        if (!resp.is2xx()) {
            throw new RuntimeException("Confluence 搜索失败 HTTP " + resp.status + ": " + resp.body);
        }

        JsonNode root = mapper.readTree(resp.body);
        JsonNode results = root.path("results");
        List<IngestRequest> out = new ArrayList<>();
        if (results.isArray()) {
            for (JsonNode p : results) {
                String id = p.path("id").asText();
                String title = p.path("title").asText("Untitled");
                String html = p.path("body").path("storage").path("value").asText("");
                String markdown = HtmlToMarkdown.convert(html);
                String pageUrl = baseUrl + p.path("_links").path("webui").asText("");

                Map<String, Object> meta = new LinkedHashMap<>();
                meta.put("confluenceId", id);
                meta.put("space", spaceKey);
                meta.put("source", "confluence");

                out.add(IngestRequest.builder()
                        .id("confluence:" + baseUrl + ":" + id)
                        .sourceType(DataSourceType.CONFLUENCE)
                        .sourceId(sourceId)
                        .content(markdown)
                        .contentType("text/markdown")
                        .workspace(workspace)
                        .title(title)
                        .sourceUrl(pageUrl)
                        .category("confluence")
                        .metadata(meta)
                        .build());
            }
        }
        log.info("ConfluenceSource [{}] 从 {} 拉取 {} 个页面", sourceId, spaceKey, out.size());
        return out;
    }
}