package com.zifang.z.kb.ingest.util;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * 轻量 HTTP 工具 — 用 JDK 自带的 {@link HttpURLConnection} 完成 GET/POST，
 * 避免引入 OkHttp / HttpClient 等额外依赖。
 *
 * <p>专供语雀、Notion、Confluence、飞书、钉钉等接入源使用。
 */
public final class HttpHelper {

    private HttpHelper() {}

    public static class Response {
        public final int status;
        public final String body;
        public final Map<String, String> headers = new HashMap<>();

        public Response(int status, String body) {
            this.status = status;
            this.body = body;
        }

        public boolean is2xx() { return status >= 200 && status < 300; }
    }

    public static Response get(String url, Map<String, String> headers) throws IOException {
        return request("GET", url, null, headers, 30000);
    }

    public static Response get(String url) throws IOException {
        return get(url, null);
    }

    public static Response postJson(String url, String body, Map<String, String> headers) throws IOException {
        if (headers == null) headers = new HashMap<>();
        headers.putIfAbsent("Content-Type", "application/json; charset=utf-8");
        return request("POST", url, body, headers, 30000);
    }

    public static Response request(String method, String url, String body,
                                    Map<String, String> headers, int timeoutMs) throws IOException {
        URL u = URI.create(url).toURL();
        HttpURLConnection conn = (HttpURLConnection) u.openConnection();
        conn.setRequestMethod(method);
        conn.setConnectTimeout(timeoutMs);
        conn.setReadTimeout(timeoutMs);
        conn.setInstanceFollowRedirects(true);

        if (headers != null) {
            for (Map.Entry<String, String> e : headers.entrySet()) {
                conn.setRequestProperty(e.getKey(), e.getValue());
            }
        }

        if (body != null) {
            conn.setDoOutput(true);
            byte[] data = body.getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(data.length);
            try (java.io.OutputStream os = conn.getOutputStream()) {
                os.write(data);
            }
        }

        int status = conn.getResponseCode();
        InputStream is = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
        String respBody = "";
        if (is != null) {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line).append('\n');
                }
                respBody = sb.toString();
            }
        }

        Response resp = new Response(status, respBody);
        conn.getHeaderFields().forEach((k, v) -> {
            if (k != null && !v.isEmpty()) {
                resp.headers.put(k, v.get(0));
            }
        });

        return resp;
    }
}