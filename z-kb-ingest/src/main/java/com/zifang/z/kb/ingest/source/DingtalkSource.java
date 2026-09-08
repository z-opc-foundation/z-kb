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
 * 钉钉文档数据源 — 钉钉开放 API。
 *
 * <p>必填 config：
 * <ul>
 *   <li>{@code appKey} / {@code appSecret}</li>
 *   <li>{@code workspaceId}：钉钉文档 workspace ID</li>
 * </ul>
 */
public class DingtalkSource implements DataSource {

    private static final Logger log = LoggerFactory.getLogger(DingtalkSource.class);
    private static final String TOKEN_URL = "https://oapi.dingtalk.com/gettoken";

    private final String sourceId;
    private final ObjectMapper mapper = new ObjectMapper();

    public DingtalkSource(String sourceId) {
        this.sourceId = sourceId;
    }

    public DingtalkSource() {
        this("dingtalk-default");
    }

    @Override
    public String getSourceId() { return sourceId; }

    @Override
    public DataSourceType getType() { return DataSourceType.DINGTALK; }

    @Override
    public List<IngestRequest> fetch(Map<String, Object> config) throws Exception {
        String appKey = (String) config.get("appKey");
        String appSecret = (String) config.get("appSecret");
        if (appKey == null || appSecret == null) {
            throw new IllegalArgumentException("appKey / appSecret 必填");
        }
        String workspaceName = (String) config.getOrDefault("workspace", "default");

        String tokenUrl = TOKEN_URL + "?appkey=" + appKey + "&appsecret=" + appSecret;
        HttpHelper.Response tokenResp = HttpHelper.get(tokenUrl);
        if (!tokenResp.is2xx()) throw new RuntimeException("钉钉 token 获取失败");
        JsonNode tokenRoot = mapper.readTree(tokenResp.body);
        String token = tokenRoot.path("access_token").asText();

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("appKey", appKey);
        meta.put("source", "dingtalk");

        // 这里简化为占位条目，真实调用 doc/list 需要 workId/unionId 等，本实现只演示框架
        List<IngestRequest> out = new ArrayList<>();
        out.add(IngestRequest.builder()
                .id("dingtalk:init:" + sourceId)
                .sourceType(DataSourceType.DINGTALK)
                .sourceId(sourceId)
                .content("# 钉钉接入占位\n\n请在钉钉开放平台配置正确的 workspaceId 后实现具体文档列表接口。\n")
                .contentType("text/markdown")
                .workspace(workspaceName)
                .title("钉钉接入初始化")
                .category("dingtalk")
                .metadata(meta)
                .build());

        log.info("DingtalkSource [{}] 初始化完成", sourceId);
        return out;
    }
}