package com.zifang.z.kb.core.source.git;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Git 托管平台的鉴权头。访问令牌走 PRIVATE-TOKEN（GitLab 约定），
 * 账号密码走 Basic；探测与同步各自使用对应协议，凭据是同一份。
 */
public final class GitAuth {

    private final String headerName;
    private final String headerValue;

    private GitAuth(String headerName, String headerValue) {
        this.headerName = headerName;
        this.headerValue = headerValue;
    }

    public static GitAuth token(String secret) {
        return new GitAuth("PRIVATE-TOKEN", secret);
    }

    public static GitAuth basic(String username, String secret) {
        String user = username == null || username.trim().isEmpty() ? "git" : username.trim();
        String encoded = Base64.getEncoder()
                .encodeToString((user + ":" + secret).getBytes(StandardCharsets.UTF_8));
        return new GitAuth("Authorization", "Basic " + encoded);
    }

    /** 凭据类型为 TOKEN 时用 PRIVATE-TOKEN，否则按账号密码走 Basic。 */
    public static GitAuth of(String credentialType, String username, String secret) {
        if ("TOKEN".equalsIgnoreCase(credentialType)) {
            return token(secret);
        }
        return basic(username, secret);
    }

    public String getHeaderName() {
        return headerName;
    }

    public String getHeaderValue() {
        return headerValue;
    }
}
