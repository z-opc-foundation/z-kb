package com.zifang.z.kb.core.embedding;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.zifang.z.kb.api.EmbeddingProvider;
import com.zifang.z.kb.api.KBException;
import com.zifang.util.http.client.HttpExecutionResult;
import com.zifang.util.http.client.HttpExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * HTTP Embedding Provider — 通过 HTTP 调用远程 Embedding 服务。
 *
 * <p>兼容 OpenAI / 通义千问 / 智谱 GLM 等 OpenAI 协议兼容服务。
 *
 * <p>使用示例：
 * <pre>{@code
 * HttpEmbeddingProvider provider = new HttpEmbeddingProvider(
 *     "https://api.openai.com/v1/embeddings",
 *     "text-embedding-3-small",
 *     "sk-xxxx",
 *     1536
 * );
 * float[] v = provider.embed("InfluxDB 是时序数据库");
 * }</pre>
 */
public class HttpEmbeddingProvider implements EmbeddingProvider {

    private static final Logger log = LoggerFactory.getLogger(HttpEmbeddingProvider.class);

    private final String endpoint;
    private final String model;
    private final String apiKey;
    private final int dimension;
    private final HttpExecutor httpExecutor;
    private final ObjectMapper mapper = new ObjectMapper();

    public HttpEmbeddingProvider(String endpoint, String model, String apiKey, int dimension) {
        this.endpoint = endpoint;
        this.model = model;
        this.apiKey = apiKey;
        this.dimension = dimension;
        // 共享客户端：connect 10s / read 60s / write 10s，与原 HttpClient.newBuilder()
        // .connectTimeout(10s) + 请求 timeout 60s 的预算一致。
        this.httpExecutor = HttpExecutor.getDefault();
    }

    @Override
    public float[] embed(String text) {
        try {
            List<float[]> batch = callRemote(Collections.singletonList(text));
            return batch.get(0);
        } catch (Exception e) {
            throw new KBException("HTTP embedding failed: " + e.getMessage(), e);
        }
    }

    @Override
    public List<float[]> embedBatch(List<String> texts) {
        if (texts == null || texts.isEmpty()) return new ArrayList<>();
        try {
            return callRemote(texts);
        } catch (Exception e) {
            throw new KBException("HTTP embedding batch failed: " + e.getMessage(), e);
        }
    }

    @Override
    public int dimension() { return dimension; }

    @Override
    public String providerName() { return "http:" + model; }

    private List<float[]> callRemote(List<String> texts) throws Exception {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", model);
        if (texts.size() == 1) {
            body.put("input", texts.get(0));
        } else {
            ArrayNode arr = mapper.createArrayNode();
            for (String t : texts) arr.add(t);
            body.set("input", arr);
        }

        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Content-Type", "application/json");
        headers.put("Authorization", "Bearer " + apiKey);

        HttpExecutionResult resp = httpExecutor.executeByMethodUrl(
                "POST", endpoint, headers, mapper.writeValueAsString(body));
        if (resp.getStatus() / 100 != 2) {
            throw new KBException("HTTP " + resp.getStatus() + ": "
                    + (resp.getBody() != null ? resp.getBody() : resp.getError()));
        }

        JsonNode root = mapper.readTree(resp.getBody());
        JsonNode data = root.path("data");
        List<float[]> result = new ArrayList<>(data.size());
        // 按 index 排序
        java.util.TreeMap<Integer, float[]> ordered = new java.util.TreeMap<>();
        for (JsonNode item : data) {
            int idx = item.path("index").asInt();
            float[] vec = parseVector(item.path("embedding"));
            ordered.put(idx, vec);
        }
        result.addAll(ordered.values());
        return result;
    }

    private float[] parseVector(JsonNode array) {
        if (!array.isArray()) {
            throw new KBException("Invalid embedding response: not an array");
        }
        float[] result = new float[array.size()];
        for (int i = 0; i < array.size(); i++) {
            result[i] = (float) array.get(i).asDouble();
        }
        return result;
    }
}
