package com.zifang.z.kb.core.source.git;

/**
 * 从 HTTPS 仓库地址拆出「站点根地址 + 项目路径」，用于拼 GitLab REST 端点。
 * 例如 https://code.example.com/group/sub/repo.git → https://code.example.com + group/sub/repo。
 */
public final class GitRepoUrl {

    private final String baseUrl;
    private final String projectPath;

    private GitRepoUrl(String baseUrl, String projectPath) {
        this.baseUrl = baseUrl;
        this.projectPath = projectPath;
    }

    /** 只接受 http(s) 地址；SSH 地址让调用方提示改用 HTTPS。解析失败返回 null。 */
    public static GitRepoUrl parse(String repo) {
        if (repo == null || repo.trim().isEmpty()) {
            return null;
        }
        String value = repo.trim();
        int schemeEnd = value.indexOf("://");
        if (schemeEnd <= 0) {
            return null;
        }
        String scheme = value.substring(0, schemeEnd).toLowerCase();
        if (!"http".equals(scheme) && !"https".equals(scheme)) {
            return null;
        }
        int pathStart = value.indexOf('/', schemeEnd + 3);
        if (pathStart <= 0) {
            return null;
        }
        String base = value.substring(0, pathStart);
        String path = value.substring(pathStart + 1);
        if (path.endsWith(".git")) {
            path = path.substring(0, path.length() - 4);
        }
        path = path.replaceAll("/+$", "");
        if (path.isEmpty()) {
            return null;
        }
        return new GitRepoUrl(base, path);
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public String getProjectPath() {
        return projectPath;
    }

    /** 项目末段名称，用于资料树节点与物料标题。 */
    public String getProjectName() {
        int slash = projectPath.lastIndexOf('/');
        return slash >= 0 ? projectPath.substring(slash + 1) : projectPath;
    }
}
