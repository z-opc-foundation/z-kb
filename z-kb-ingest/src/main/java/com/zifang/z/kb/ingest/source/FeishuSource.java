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
 * 飞书数据源 — 飞书开放平台 Open API。
 *
 * <p>必填 config：
 * <ul>
 *   <li>{@code appId} / {@code appSecret}：应用凭证</li>
 *   <li>{@code spaceId}：知识库空间 ID</li>
 * </ul>
 *
 * <p>实现说明：先调用 /auth/v3/tenant_access_token/internal 获取 token，再调用 /wiki/v2/spaces 获取节点列表。
 */
public class FeishuSource implements DataSource {

    private static final Logger log = LoggerFactory.getLogger(FeishuSource.class);
    private static final String AUTH_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";
    private static final String NODES_URL = "https://open.feishu.cn/open-apis/wiki/v2/spaces/%s/nodes";

    private final String sourceId;
    private final ObjectMapper mapper = new ObjectMapper();

    public FeishuSource(String sourceId) {
        this.sourceId = sourceId;
    }

    public FeishuSource() {
        this("feishu-default");
    }

    @Override
    public String getSourceId() { return sourceId; }

    @Override
    public DataSourceType getType() { return DataSourceType.FEISHU; }

    @Override
    public List<IngestRequest> fetch(Map<String, Object> config) throws Exception {
        String appId = (String) config.get("appId");
        String appSecret = (String) config.get("appSecret");
        String spaceId = (String) config.get("spaceId");
        if (appId == null || appSecret == null || spaceId == null) {
            throw new IllegalArgumentException("appId / appSecret / spaceId 必填");
        }
        String workspace = (String) config.getOrDefault("workspace", "default");

        // 1) 取 access token
        Map<String, String> headers = new HashMap<>();
        headers.put("Content-Type", "application/json; charset=utf-8");

        String authBody = String.format("{\"app_id\":\"%s\",\"app_secret\":\"%s\"}", appId, appSecret);
        HttpHelper.Response authResp = HttpHelper.postJson(AUTH_URL, authBody, headers);
        if (!authResp.is2xx()) throw new RuntimeException("飞书鉴权失败: " + authResp.status);
        JsonNode authRoot = mapper.readTree(authResp.body);
        String token = authRoot.path("tenant_access_token").asText();
        if (token.isEmpty()) throw new RuntimeException("飞书未返回 tenant_access_token: " + authResp.body);

        // 2) 列节点
        Map<String, String> auth = new HashMap<>();
        auth.put("Authorization", "Bearer " + token);
        HttpHelper.Response listResp = HttpHelper.get(String.format(NODES_URL, spaceId), auth);
        if (!listResp.is2xx()) throw new RuntimeException("飞书节点列表失败: " + listResp.status);
        JsonNode listRoot = mapper.readTree(listResp.body);
        JsonNode items = listRoot.path("data").path("items");
        List<IngestRequest> out = new ArrayList<>();
        if (items.isArray()) {
            for (JsonNode item : items) {
                String objToken = item.path("obj_token").asText();
                String title = item.path("title").asText("Untitled");
                String nodeUrl = String.format("https://open.feishu.cn/open-apis/wiki/v2/spaces/%s/nodes/%s", spaceId, objToken);
                HttpHelper.Response docResp = HttpHelper.get(nodeUrl, auth);
                if (!docResp.is2xx()) continue;
                JsonNode docRoot = mapper.readTree(docResp.body);
                String content = docRoot.path("data").path("node").path("obj_create_time").asText("") + "\n\n"
                        + "(详细内容见飞书页面)";

                Map<String, Object> meta = new LinkedHashMap<>();
                meta.put("objToken", objToken);
                meta.put("spaceId", spaceId);
                meta.put("source", "feishu");

                out.add(IngestRequest.builder()
                        .id("feishu:" + spaceId + ":" + objToken)
                        .sourceType(DataSourceType.FEISHU)
                        .sourceId(sourceId)
                        .content(content)
                        .contentType("text/markdown")
                        .workspace(workspace)
                        .title(title)
                        .category("feishu")
                        .metadata(meta)
                        .build());
            }
        }
        log.info("FeishuSource [{}] 从 {} 拉取 {} 个文档", sourceId, spaceId, out.size());
        return out;
    }
}