package com.zifang.z.kb.core.source.git;

import com.zifang.util.http.client.HttpExecutionResult;
import com.zifang.util.http.client.HttpExecutor;
import com.zifang.util.json.JsonCursor;
import com.zifang.util.json.JsonUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.UnsupportedEncodingException;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * GitLab REST v4 客户端：仓库文件树与原始文件内容。
 * 站点地址与项目路径由仓库地址解析而来，凭据按 TOKEN / BASIC 走不同头。
 */
public class GitApiClient {

    private static final Logger LOG = LoggerFactory.getLogger(GitApiClient.class);

    private static final int ERROR_BODY_LIMIT = 512;

    private final int connectTimeoutMs;
    private final int readTimeoutMs;
    private final String allowedHosts;
    private final HttpExecutor executor;

    public GitApiClient(int connectTimeoutMs, int readTimeoutMs, String allowedHosts) {
        this.connectTimeoutMs = connectTimeoutMs;
        this.readTimeoutMs = readTimeoutMs;
        this.allowedHosts = allowedHosts == null ? "" : allowedHosts.trim();
        this.executor = new HttpExecutor(connectTimeoutMs, readTimeoutMs, readTimeoutMs,
                TimeUnit.MILLISECONDS);
    }

    public GitApiClient() {
        this(5000, 20000, "");
    }

    /** 配置了白名单就只允许这些站点，避免接入源把后端当任意地址的代理。 */
    public boolean isHostAllowed(String baseUrl) {
        if (allowedHosts.isEmpty()) {
            return true;
        }
        String host;
        try {
            host = new URL(baseUrl).getHost();
        } catch (MalformedURLException e) {
            return false;
        }
        if (host == null) {
            return false;
        }
        for (String allowed : allowedHosts.split(",")) {
            if (host.equalsIgnoreCase(allowed.trim())) {
                return true;
            }
        }
        return false;
    }

    /** GET /projects/{path}：项目详情，用于连通探测。 */
    public JsonCursor getProject(String baseUrl, String projectPath, GitAuth auth) {
        String body = get(baseUrl + "/api/v4/projects/" + encode(projectPath), auth,
                "application/json");
        JsonCursor root = JsonCursor.of(JsonUtil.parse(body));
        if (!root.isObject()) {
            throw new GitApiException(GitApiException.Kind.INVALID_RESPONSE,
                    "Git 项目接口返回的不是对象");
        }
        return root;
    }

    /** GET /projects/{path}/repository/tree?ref=&recursive=true，一页一条请求。 */
    public List<GitFileNode> listTree(String baseUrl, String projectPath, String ref, int page,
            int perPage, GitAuth auth) {
        String url = baseUrl + "/api/v4/projects/" + encode(projectPath) + "/repository/tree"
                + "?ref=" + encode(ref) + "&recursive=true&per_page=" + perPage + "&page=" + page;
        return toFileList(get(url, auth, "application/json"));
    }

    /** GET /projects/{path}/repository/commits?ref_name=&per_page=1：取分支最新提交，空仓返回 null。 */
    public String latestCommit(String baseUrl, String projectPath, String ref, GitAuth auth) {
        String url = baseUrl + "/api/v4/projects/" + encode(projectPath) + "/repository/commits"
                + "?ref_name=" + encode(ref) + "&per_page=1";
        List<JsonCursor> commits = toList(get(url, auth, "application/json"));
        if (commits.isEmpty()) {
            return null;
        }
        JsonCursor id = commits.get(0).path("id");
        return id.isMissing() || id.isNull() ? null : id.asText();
    }

    /** GET /projects/{path}/repository/files/{file}/raw：原样返回文件文本。 */
    public String readRawFile(String baseUrl, String projectPath, String filePath, String ref,
            GitAuth auth) {
        String url = baseUrl + "/api/v4/projects/" + encode(projectPath) + "/repository/files/"
                + encode(filePath) + "/raw?ref=" + encode(ref);
        return get(url, auth, "text/plain, */*");
    }

    private String get(String url, GitAuth auth, String accept) {
        long start = System.currentTimeMillis();
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Accept", accept);
        if (auth != null) {
            headers.put(auth.getHeaderName(), auth.getHeaderValue());
        }
        HttpExecutionResult result = executor.executeByMethodUrl("GET", url, headers, null);
        int code = result.getStatus();
        String body = result.getBody() == null ? "" : result.getBody();
        LOG.debug("Git 接口调用完成：url={}, status={}, costMs={}", url, code,
                System.currentTimeMillis() - start);
        if (code <= 0) {
            throw new GitApiException(GitApiException.Kind.NETWORK,
                    "Git 接口调用失败（" + fallback(result.getError(), "无响应") + "）：" + url);
        }
        handleError(url, code, body);
        return body;
    }

    private void handleError(String url, int code, String body) {
        if (code >= 200 && code < 300) {
            return;
        }
        String detail = truncate(body);
        if (code == 401 || code == 403) {
            throw new GitApiException(GitApiException.Kind.UNAUTHORIZED, code,
                    "Git 凭据无效或无权访问（HTTP " + code + "）：" + detail, null);
        }
        if (code == 404) {
            throw new GitApiException(GitApiException.Kind.NOT_FOUND, code,
                    "Git 资源不存在（HTTP 404）：" + detail, null);
        }
        if (code == 429) {
            throw new GitApiException(GitApiException.Kind.RATE_LIMITED, code,
                    "Git 接口限流，请稍后重试：" + detail, null);
        }
        if (code >= 500) {
            throw new GitApiException(GitApiException.Kind.SERVER, code,
                    "Git 服务异常（HTTP " + code + "）：" + detail, null);
        }
        throw new GitApiException(GitApiException.Kind.INVALID_RESPONSE, code,
                "Git 接口返回 HTTP " + code + "：" + detail, null);
    }

    private static List<GitFileNode> toFileList(String body) {
        List<GitFileNode> nodes = new ArrayList<>();
        for (JsonCursor item : toList(body)) {
            JsonCursor path = item.path("path");
            if (path.isMissing() || path.isNull()) {
                continue;
            }
            JsonCursor type = item.path("type");
            JsonCursor id = item.path("id");
            nodes.add(new GitFileNode(path.asText(),
                    type.isMissing() || type.isNull() ? null : type.asText(),
                    id.isMissing() || id.isNull() ? null : id.asText()));
        }
        return nodes;
    }

    private static List<JsonCursor> toList(String body) {
        JsonCursor root = JsonCursor.of(JsonUtil.parse(body));
        if (!root.isArray()) {
            throw new GitApiException(GitApiException.Kind.INVALID_RESPONSE,
                    "Git 接口返回的不是数组");
        }
        return root.elements();
    }

    private static String truncate(String body) {
        if (body == null || body.isEmpty()) {
            return "无响应体";
        }
        String trimmed = body.trim();
        return trimmed.length() > ERROR_BODY_LIMIT ? trimmed.substring(0, ERROR_BODY_LIMIT)
                : trimmed;
    }

    private static String fallback(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value;
    }

    private static String encode(String value) {
        if (value == null || value.isEmpty()) {
            throw new IllegalArgumentException("Git 路径参数不能为空");
        }
        try {
            return URLEncoder.encode(value, "UTF-8").replace("+", "%20");
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }
}
