package com.zifang.z.kb.core.source.yuque;

import com.zifang.util.http.client.HttpExecutionResult;
import com.zifang.util.http.client.HttpExecutor;
import com.zifang.util.json.JsonCursor;
import com.zifang.util.json.JsonUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * 语雀 OpenAPI v2 客户端：GET + {@code X-Auth-Token}，响应统一取 {@code data} 节点。
 * 失败抛 {@link YuqueApiException}，由调用方按 kind 决定重试或直接暴露。
 *
 * <p>HTTP 走 z-util {@code HttpExecutor}，JSON 走 z-util {@code JsonUtil/JsonCursor}，
 * 与本仓「不引 Jackson」的口径一致。</p>
 */
public class YuqueApiClient {

    private static final Logger LOG = LoggerFactory.getLogger(YuqueApiClient.class);

    public static final String DEFAULT_BASE_URL = "https://www.yuque.com/api/v2";

    private static final int ERROR_BODY_LIMIT = 512;

    private final String baseUrl;
    private final int connectTimeoutMs;
    private final int readTimeoutMs;
    private final HttpExecutor executor;

    public YuqueApiClient(String baseUrl, int connectTimeoutMs, int readTimeoutMs) {
        String normalized = baseUrl == null ? "" : baseUrl.trim().replaceAll("/+$", "");
        this.baseUrl = normalized.isEmpty() ? DEFAULT_BASE_URL : normalized;
        this.connectTimeoutMs = connectTimeoutMs;
        this.readTimeoutMs = readTimeoutMs;
        this.executor = new HttpExecutor(connectTimeoutMs, readTimeoutMs, readTimeoutMs,
                TimeUnit.MILLISECONDS);
    }

    public YuqueApiClient() {
        this(DEFAULT_BASE_URL, 5000, 10000);
    }

    /** GET /user：团队 Token 返回团队信息（type=Group），个人 Token 返回个人用户。 */
    public JsonCursor getUser(String token) {
        return getData("/user", token);
    }

    /** 复制一份指向指定域名的客户端（租户独立域名），超时沿用当前配置。 */
    public YuqueApiClient withBaseUrl(String customBaseUrl) {
        String normalized = customBaseUrl == null ? "" : customBaseUrl.trim().replaceAll("/+$", "");
        if (normalized.isEmpty() || normalized.equals(baseUrl)) {
            return this;
        }
        return new YuqueApiClient(normalized, connectTimeoutMs, readTimeoutMs);
    }

    /** GET /users/{login}/groups：当前账号加入的团队，供接入源先选团队空间。 */
    public List<YuqueGroup> listUserGroups(String login, String token, int offset, int limit) {
        String path = "/users/" + encodeSegment(login) + "/groups?offset=" + offset
                + "&limit=" + limit;
        List<YuqueGroup> groups = new ArrayList<>();
        for (JsonCursor item : toList(getData(path, token))) {
            String slug = text(item, "login");
            if (slug == null) {
                continue;
            }
            groups.add(new YuqueGroup(slug, fallback(text(item, "name"), slug)));
        }
        return groups;
    }

    /** GET /groups/{groupSlug}/repos?type=Book：团队下知识库列表（分页，单页上限 100）。 */
    public List<YuqueBook> listBooks(String groupSlug, String token, int offset, int limit) {
        String path = "/groups/" + encodeSegment(groupSlug) + "/repos?type=Book&offset="
                + offset + "&limit=" + limit;
        List<YuqueBook> books = new ArrayList<>();
        for (JsonCursor item : toList(getData(path, token))) {
            String slug = text(item, "slug");
            if (slug == null) {
                continue;
            }
            String namespace = fallback(text(item, "namespace"), groupSlug + "/" + slug);
            JsonCursor docsCount = item.path("items_count");
            JsonCursor visibility = item.path("public");
            books.add(new YuqueBook(namespace, slug, fallback(text(item, "name"), slug),
                    docsCount.isScalar() ? docsCount.asInt(0) : null,
                    visibility.isScalar() ? visibility.asInt(0) : null));
        }
        return books;
    }

    /** GET /repos/{namespace}/toc：知识库目录树，namespace 形如 {@code group/book}。 */
    public List<YuqueTocNode> fetchToc(String namespace, String token) {
        List<YuqueTocNode> nodes = new ArrayList<>();
        for (JsonCursor item : toList(getData("/repos/" + encodeNamespace(namespace) + "/toc",
                token))) {
            nodes.add(new YuqueTocNode(text(item, "uuid"), text(item, "parent_uuid"),
                    text(item, "type"), text(item, "slug"), text(item, "title"),
                    text(item, "doc_id"), item.path("level").asInt(0),
                    item.path("visible").asInt(1)));
        }
        return nodes;
    }

    /** GET /repos/{namespace}/docs：文档列表，带 content_updated_at，用于逐篇判断是否变化。 */
    public List<YuqueDoc> listDocs(String namespace, String token, int offset, int limit) {
        String path = "/repos/" + encodeNamespace(namespace) + "/docs?offset=" + offset
                + "&limit=" + limit;
        List<YuqueDoc> docs = new ArrayList<>();
        for (JsonCursor item : toList(getData(path, token))) {
            String slug = text(item, "slug");
            if (slug == null) {
                continue;
            }
            String updatedAt = text(item, "content_updated_at");
            if (updatedAt == null) {
                updatedAt = text(item, "updated_at");
            }
            docs.add(new YuqueDoc(text(item, "id"), slug, fallback(text(item, "title"), slug),
                    updatedAt));
        }
        return docs;
    }

    /** GET /repos/{namespace}/docs/{docSlug}：文档详情，body 为 markdown 或表格类 JSON 串。 */
    public YuqueDocDetail fetchDocDetail(String namespace, String docSlug, String token) {
        JsonCursor data = getData("/repos/" + encodeNamespace(namespace) + "/docs/"
                + encodeSegment(docSlug), token);
        String body = text(data, "body");
        String updatedAt = text(data, "content_updated_at");
        if (updatedAt == null) {
            updatedAt = text(data, "updated_at");
        }
        return new YuqueDocDetail(text(data, "id"), fallback(text(data, "slug"), docSlug),
                text(data, "title"), text(data, "book_id"), updatedAt, body == null ? "" : body);
    }

    private JsonCursor getData(String path, String token) {
        String url = baseUrl + path;
        long start = System.currentTimeMillis();
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("X-Auth-Token", token == null ? "" : token);
        headers.put("Accept", "application/json");
        HttpExecutionResult result = executor.executeByMethodUrl("GET", url, headers, null);
        int code = result.getStatus();
        String body = result.getBody() == null ? "" : result.getBody();
        LOG.debug("语雀接口调用完成：url={}, status={}, costMs={}", url, code,
                System.currentTimeMillis() - start);
        if (code <= 0) {
            throw new YuqueApiException(YuqueApiException.Kind.NETWORK,
                    "语雀接口调用失败（" + fallback(result.getError(), "无响应") + "）：" + url);
        }
        handleError(url, code, body, result.getHeaders());
        JsonCursor data = JsonCursor.of(JsonUtil.parse(body)).path("data");
        if (data.isMissing() || data.isNull()) {
            throw new YuqueApiException(YuqueApiException.Kind.INVALID_RESPONSE,
                    "语雀接口返回缺少 data 字段：" + url);
        }
        return data;
    }

    private void handleError(String url, int code, String body, Map<String, String> headers) {
        if (code >= 200 && code < 300) {
            return;
        }
        String detail = extractMessage(body);
        if (code == 401 || code == 403) {
            throw new YuqueApiException(YuqueApiException.Kind.UNAUTHORIZED, code,
                    "语雀 Token 无效或无权访问：" + detail, null);
        }
        if (code == 404) {
            throw new YuqueApiException(YuqueApiException.Kind.NOT_FOUND, code,
                    "语雀资源不存在：" + detail, null);
        }
        if (code == 429) {
            throw new YuqueApiException(YuqueApiException.Kind.RATE_LIMITED, code,
                    "语雀接口限流，请稍后重试：" + detail, parseLongOrNull(header(headers,
                    "Retry-After")));
        }
        if (code >= 500) {
            throw new YuqueApiException(YuqueApiException.Kind.SERVER, code,
                    "语雀服务异常（HTTP " + code + "）：" + detail, null);
        }
        throw new YuqueApiException(YuqueApiException.Kind.INVALID_RESPONSE, code,
                "语雀接口返回 HTTP " + code + "：" + detail, null);
    }

    private static List<JsonCursor> toList(JsonCursor data) {
        if (!data.isArray()) {
            throw new YuqueApiException(YuqueApiException.Kind.INVALID_RESPONSE,
                    "语雀接口返回的 data 不是数组");
        }
        return data.elements();
    }

    /** 错误体里尽量取语雀的 message 字段，取不到就截断原文。 */
    private static String extractMessage(String body) {
        if (body == null || body.isEmpty()) {
            return "无响应体";
        }
        String message = text(JsonCursor.of(JsonUtil.parse(body)), "message");
        if (message != null) {
            return message;
        }
        String trimmed = body.trim();
        return trimmed.length() > ERROR_BODY_LIMIT ? trimmed.substring(0, ERROR_BODY_LIMIT)
                : trimmed;
    }

    private static String text(JsonCursor node, String field) {
        JsonCursor value = node == null ? JsonCursor.missing() : node.path(field);
        if (value.isMissing() || value.isNull()) {
            return null;
        }
        String text = value.asText();
        return text == null || text.trim().isEmpty() ? null : text;
    }

    private static String fallback(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value;
    }

    private static String header(Map<String, String> headers, String name) {
        if (headers == null || name == null) {
            return null;
        }
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            if (entry.getKey() != null && entry.getKey().equalsIgnoreCase(name)) {
                return entry.getValue();
            }
        }
        return null;
    }

    private static Long parseLongOrNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String encodeNamespace(String namespace) {
        if (namespace == null || namespace.isEmpty()) {
            throw new IllegalArgumentException("namespace 不能为空");
        }
        String[] segments = namespace.split("/");
        StringBuilder sb = new StringBuilder();
        for (String segment : segments) {
            if (segment.isEmpty()) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append('/');
            }
            sb.append(encodeSegment(segment));
        }
        return sb.toString();
    }

    private static String encodeSegment(String value) {
        if (value == null || value.isEmpty()) {
            throw new IllegalArgumentException("语雀路径参数不能为空");
        }
        try {
            return URLEncoder.encode(value, "UTF-8").replace("+", "%20");
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }
}
