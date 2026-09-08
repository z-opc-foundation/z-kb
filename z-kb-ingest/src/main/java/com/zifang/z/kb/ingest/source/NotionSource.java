package com.zifang.z.kb.ingest.source;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zifang.z.kb.ingest.api.DataSource;
import com.zifang.z.kb.ingest.api.DataSourceType;
import com.zifang.z.kb.ingest.api.IngestRequest;
import com.zifang.z.kb.ingest.util.HttpHelper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

/**
 * Notion 数据源 — 走 Notion v1 API 拉取数据库或页面列表，再递归展开 block 子树。
 *
 * <p>必填 config：
 * <ul>
 *   <li>{@code token}：Notion integration token</li>
 *   <li>{@code databaseId}：数据库 ID（与 pageId 二选一）</li>
 *   <li>{@code pageId}：页面 ID（与 databaseId 二选一）</li>
 * </ul>
 */
public class NotionSource implements DataSource {

    private static final Logger log = LoggerFactory.getLogger(NotionSource.class);
    private static final String BASE = "https://api.notion.com/v1";

    private final String sourceId;
    private final ObjectMapper mapper = new ObjectMapper();

    public NotionSource(String sourceId) {
        this.sourceId = sourceId;
    }

    public NotionSource() {
        this("notion-default");
    }

    @Override
    public String getSourceId() { return sourceId; }

    @Override
    public DataSourceType getType() { return DataSourceType.NOTION; }

    @Override
    public List<IngestRequest> fetch(Map<String, Object> config) throws Exception {
        String token = (String) config.get("token");
        if (token == null || token.isEmpty()) throw new IllegalArgumentException("Notion token 不能为空");

        String workspace = (String) config.getOrDefault("workspace", "default");
        String databaseId = (String) config.get("databaseId");
        String pageId = (String) config.get("pageId");
        if (databaseId == null && pageId == null) {
            throw new IllegalArgumentException("databaseId 与 pageId 至少需要一个");
        }

        Map<String, String> headers = new HashMap<>();
        headers.put("Authorization", "Bearer " + token);
        headers.put("Notion-Version", "2022-06-28");
        headers.put("Content-Type", "application/json");

        List<String> pageIds = new ArrayList<>();
        if (databaseId != null) {
            // 查询数据库
            String body = "{\"page_size\":100}";
            HttpHelper.Response dbResp = HttpHelper.postJson(BASE + "/databases/" + databaseId + "/query", body, headers);
            if (!dbResp.is2xx()) {
                throw new RuntimeException("Notion 数据库查询失败: " + dbResp.status);
            }
            JsonNode root = mapper.readTree(dbResp.body);
            JsonNode results = root.path("results");
            if (results.isArray()) {
                for (JsonNode r : results) {
                    pageIds.add(r.path("id").asText());
                }
            }
        } else {
            pageIds.add(pageId);
        }

        List<IngestRequest> result = new ArrayList<>();
        for (String pid : pageIds) {
            try {
                IngestRequest req = fetchPage(pid, headers, workspace);
                if (req != null) result.add(req);
            } catch (Exception e) {
                log.warn("Notion page {} 抓取失败: {}", pid, e.getMessage());
            }
        }
        log.info("NotionSource [{}] 拉取 {} 个页面", sourceId, result.size());
        return result;
    }

    private IngestRequest fetchPage(String pageId, Map<String, String> headers, String workspace) throws Exception {
        HttpHelper.Response pageResp = HttpHelper.get(BASE + "/pages/" + pageId, headers);
        if (!pageResp.is2xx()) throw new RuntimeException("page " + pageId + " HTTP " + pageResp.status);
        JsonNode pageRoot = mapper.readTree(pageResp.body);
        String title = extractTitle(pageRoot);

        // 抓 block
        StringBuilder content = new StringBuilder();
        String cursor = null;
        do {
            String url = BASE + "/blocks/" + pageId + "/children?page_size=100" + (cursor != null ? "&start_cursor=" + cursor : "");
            HttpHelper.Response blockResp = HttpHelper.get(url, headers);
            if (!blockResp.is2xx()) break;
            JsonNode blockRoot = mapper.readTree(blockResp.body);
            JsonNode results = blockRoot.path("results");
            if (results.isArray()) {
                for (JsonNode block : results) {
                    renderBlock(block, content, headers, 0);
                }
            }
            cursor = blockRoot.path("next_cursor").isNull() ? null : blockRoot.path("next_cursor").asText(null);
            if (blockRoot.path("has_more").asBoolean(false)) {
                // continue
            } else {
                cursor = null;
            }
        } while (cursor != null);

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("notionPageId", pageId);
        meta.put("source", "notion");

        return IngestRequest.builder()
                .id("notion:" + pageId)
                .sourceType(DataSourceType.NOTION)
                .sourceId(sourceId)
                .content(content.toString())
                .contentType("text/markdown")
                .workspace(workspace)
                .title(title)
                .sourceUrl("https://www.notion.so/" + pageId.replace("-", ""))
                .category("notion")
                .metadata(meta)
                .build();
    }

    private String extractTitle(JsonNode page) {
        JsonNode titleNode = page.path("properties").path("title");
        if (titleNode.isArray() && titleNode.size() > 0) {
            return titleNode.get(0).path("text").path("content").asText("Untitled");
        }
        JsonNode props = page.path("properties");
        if (props.fields() != null && props.fields().hasNext()) {
            var first = props.fields().next();
            JsonNode v = first.getValue();
            if (v.path("type").asText().equals("title")) {
                return v.path("title").get(0).path("text").path("content").asText("Untitled");
            }
        }
        return "Untitled";
    }

    private void renderBlock(JsonNode block, StringBuilder out, Map<String, String> headers, int depth) {
        String type = block.path("type").asText("");
        if (type.isEmpty()) return;
        JsonNode t = block.path(type);

        switch (type) {
            case "heading_1":
                out.append("\n# ").append(plainText(t.path("rich_text"))).append("\n");
                break;
            case "heading_2":
                out.append("\n## ").append(plainText(t.path("rich_text"))).append("\n");
                break;
            case "heading_3":
                out.append("\n### ").append(plainText(t.path("rich_text"))).append("\n");
                break;
            case "paragraph":
                out.append(plainText(t.path("rich_text"))).append("\n\n");
                break;
            case "bulleted_list_item":
                out.append("- ").append(plainText(t.path("rich_text"))).append("\n");
                break;
            case "numbered_list_item":
                out.append("1. ").append(plainText(t.path("rich_text"))).append("\n");
                break;
            case "code":
                out.append("\n```").append(t.path("language").asText("")).append("\n")
                        .append(plainText(t.path("rich_text"))).append("\n```\n");
                break;
            case "quote":
                out.append("> ").append(plainText(t.path("rich_text"))).append("\n\n");
                break;
            case "to_do":
                out.append(t.path("checked").asBoolean() ? "- [x] " : "- [ ] ")
                        .append(plainText(t.path("rich_text"))).append("\n");
                break;
            case "divider":
                out.append("\n---\n");
                break;
            default:
                out.append(plainText(t.path("rich_text"))).append("\n");
        }

        // 递归子 block
        if (block.path("has_children").asBoolean(false)) {
            try {
                HttpHelper.Response resp = HttpHelper.get(BASE + "/blocks/" + block.path("id").asText() + "/children", headers);
                if (resp.is2xx()) {
                    JsonNode children = mapper.readTree(resp.body).path("results");
                    if (children.isArray()) {
                        for (JsonNode c : children) {
                            renderBlock(c, out, headers, depth + 1);
                        }
                    }
                }
            } catch (Exception e) {
                // ignore
            }
        }
    }

    private String plainText(JsonNode richText) {
        if (richText == null || !richText.isArray()) return "";
        StringBuilder sb = new StringBuilder();
        for (JsonNode rt : richText) {
            sb.append(rt.path("plain_text").asText(""));
        }
        return sb.toString();
    }
}