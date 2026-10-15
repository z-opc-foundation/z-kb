package com.zifang.z.kb.ingest.source;

import com.zifang.util.json.JsonCursor;
import com.zifang.util.json.JsonUtil;
import com.zifang.z.kb.ingest.api.DataSource;
import com.zifang.z.kb.ingest.api.DataSourceType;
import com.zifang.z.kb.ingest.api.IngestRequest;
import com.zifang.z.kb.ingest.util.HttpHelper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

/**
 * 语雀数据源 — 调用 https://www.yuque.com/api/v2 拉取知识库下的文档。
 *
 * <p>必填 config：
 * <ul>
 *   <li>{@code token}：语雀 personal access token</li>
 *   <li>{@code namespace}：知识库路径，如 {@code myorg/mybook}</li>
 * </ul>
 *
 * <p>可选 config：
 * <ul>
 *   <li>{@code workspace}：目标工作台</li>
 *   <li>{@code includeDrafts}：是否包含草稿（默认 false）</li>
 *   <li>{@code limit}：最多抓多少篇</li>
 * </ul>
 */
public class YuqueSource implements DataSource {

    private static final Logger log = LoggerFactory.getLogger(YuqueSource.class);
    private static final String BASE = "https://www.yuque.com/api/v2";

    private final String sourceId;

    public YuqueSource(String sourceId) {
        this.sourceId = sourceId;
    }

    public YuqueSource() {
        this("yuque-default");
    }

    @Override
    public String getSourceId() { return sourceId; }

    @Override
    public DataSourceType getType() { return DataSourceType.YUQUE; }

    @Override
    public List<IngestRequest> fetch(Map<String, Object> config) throws Exception {
        String token = (String) config.get("token");
        String namespace = (String) config.get("namespace");
        if (token == null || token.isEmpty()) throw new IllegalArgumentException("语雀 token 不能为空");
        if (namespace == null || namespace.isEmpty()) throw new IllegalArgumentException("语雀 namespace 不能为空");

        String workspace = (String) config.getOrDefault("workspace", "default");
        int limit = (int) config.getOrDefault("limit", 100);

        Map<String, String> headers = new HashMap<>();
        headers.put("User-Agent", "z-kb/1.0");
        headers.put("X-Auth-Token", token);

        // 1) 拉取文档列表
        String listUrl = BASE + "/repos/" + namespace + "/docs?limit=" + limit;
        HttpHelper.Response listResp = HttpHelper.get(listUrl, headers);
        if (!listResp.is2xx()) {
            throw new RuntimeException("语雀文档列表拉取失败: HTTP " + listResp.status + " - " + listResp.body);
        }

        JsonCursor root = JsonCursor.of(JsonUtil.parse(listResp.body));
        JsonCursor docs = root.path("data");
        List<IngestRequest> result = new ArrayList<>();

        if (docs.isArray()) {
            for (JsonCursor doc : docs.elements()) {
                try {
                    String slug = doc.path("slug").asText();
                    String title = doc.path("title").asText();
                    long docId = doc.path("id").asLong(0L);
                    String status = textOr(doc, "status", "published");
                    if (!"published".equals(status)) {
                        log.debug("跳过未发布文档: {} ({})", title, slug);
                        continue;
                    }

                    // 2) 拉取正文
                    String docUrl = BASE + "/repos/" + namespace + "/docs/" + slug;
                    HttpHelper.Response docResp = HttpHelper.get(docUrl, headers);
                    if (!docResp.is2xx()) {
                        log.warn("文档正文拉取失败: {} - HTTP {}", slug, docResp.status);
                        continue;
                    }

                    JsonCursor docRoot = JsonCursor.of(JsonUtil.parse(docResp.body));
                    JsonCursor data = docRoot.path("data");
                    String body = textOr(data, "body", "");
                    String wordCount = String.valueOf(data.path("word_count").asInt(0));
                    String author = textOr(data.path("user"), "name", "");

                    Map<String, Object> meta = new LinkedHashMap<>();
                    meta.put("yuqueId", docId);
                    meta.put("slug", slug);
                    meta.put("namespace", namespace);
                    meta.put("source", "yuque");
                    meta.put("wordCount", wordCount);
                    meta.put("description", textOr(data, "description", ""));
                    meta.put("updatedAt", textOr(data, "updated_at", ""));

                    IngestRequest req = IngestRequest.builder()
                            .id("yuque:" + namespace + ":" + slug)
                            .sourceType(DataSourceType.YUQUE)
                            .sourceId(sourceId)
                            .content(body)
                            .contentType("text/markdown")
                            .workspace(workspace)
                            .title(title)
                            .author(author)
                            .sourceUrl("https://www.yuque.com/" + namespace + "/" + slug)
                            .path(slug)
                            .category("yuque")
                            .metadata(meta)
                            .build();
                    result.add(req);
                } catch (Exception e) {
                    log.warn("处理语雀文档失败: {}", e.getMessage());
                }
            }
        }

        log.info("YuqueSource [{}] 从 {} 拉取 {} 篇文档", sourceId, namespace, result.size());
        return result;
    }

    /** JsonCursor 没有 asText(default) 重载: 缺失 / JSON null 回退默认值. */
    private static String textOr(JsonCursor node, String field, String def) {
        JsonCursor v = node.path(field);
        return v.isMissing() || v.isNull() ? def : v.asText();
    }
}
