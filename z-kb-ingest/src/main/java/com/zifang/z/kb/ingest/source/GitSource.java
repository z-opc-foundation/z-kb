package com.zifang.z.kb.ingest.source;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zifang.z.kb.ingest.api.DataSource;
import com.zifang.z.kb.ingest.api.DataSourceType;
import com.zifang.z.kb.ingest.api.IngestRequest;
import com.zifang.z.kb.ingest.util.HttpHelper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Git 仓库数据源 — 通过 GitHub / GitLab / Gitee API 拉取 Markdown 文件。
 *
 * <p>必填 config：
 * <ul>
 *   <li>{@code platform}：github / gitlab / gitee</li>
 *   <li>{@code owner}：仓库 owner</li>
 *   <li>{@code repo}：仓库名</li>
 *   <li>{@code ref}：分支或 tag，默认 main</li>
 * </ul>
 *
 * <p>可选 config：
 * <ul>
 *   <li>{@code token}：私有仓库 token</li>
 *   <li>{@code path}：仓库内子目录（默认根目录）</li>
 *   <li>{@code workspace}：目标工作台</li>
 * </ul>
 */
public class GitSource implements DataSource {

    private static final Logger log = LoggerFactory.getLogger(GitSource.class);

    private final String sourceId;
    private final ObjectMapper mapper = new ObjectMapper();

    public GitSource(String sourceId) {
        this.sourceId = sourceId;
    }

    public GitSource() {
        this("git-default");
    }

    @Override
    public String getSourceId() { return sourceId; }

    @Override
    public DataSourceType getType() { return DataSourceType.GIT; }

    @Override
    public List<IngestRequest> fetch(Map<String, Object> config) throws Exception {
        String platform = (String) config.getOrDefault("platform", "github");
        String owner = (String) config.get("owner");
        String repo = (String) config.get("repo");
        String ref = (String) config.getOrDefault("ref", "main");
        String token = (String) config.get("token");
        String path = (String) config.getOrDefault("path", "");
        String workspace = (String) config.getOrDefault("workspace", "default");

        if (owner == null || repo == null) {
            throw new IllegalArgumentException("owner / repo 必填");
        }

        Map<String, String> headers = new HashMap<>();
        headers.put("Accept", "application/vnd.github+json");
        if (token != null && !token.isEmpty()) {
            headers.put("Authorization", "Bearer " + token);
        }

        String base = getBase(platform);
        String treeUrl = String.format("%s/repos/%s/%s/git/trees/%s?recursive=1", base, owner, repo, ref);

        HttpHelper.Response resp = HttpHelper.get(treeUrl, headers);
        if (!resp.is2xx()) {
            throw new RuntimeException("Git tree 拉取失败 HTTP " + resp.status);
        }
        JsonNode treeRoot = mapper.readTree(resp.body);
        JsonNode tree = treeRoot.path("tree");
        List<IngestRequest> out = new ArrayList<>();
        if (tree.isArray()) {
            for (JsonNode node : tree) {
                if (!"blob".equals(node.path("type").asText())) continue;
                String nodePath = node.path("path").asText();
                if (!nodePath.endsWith(".md") && !nodePath.endsWith(".markdown")) continue;
                if (!path.isEmpty() && !nodePath.startsWith(path)) continue;

                String rawUrl = String.format("%s/repos/%s/%s/contents/%s?ref=%s", base, owner, repo,
                        URLEncoder.encode(nodePath, StandardCharsets.UTF_8), ref);
                HttpHelper.Response fileResp = HttpHelper.get(rawUrl, headers);
                if (!fileResp.is2xx()) continue;
                JsonNode f = mapper.readTree(fileResp.body);
                String contentB64 = f.path("content").asText("");
                String md = new String(Base64.getDecoder().decode(contentB64.replaceAll("\\s+", "")),
                        StandardCharsets.UTF_8);

                Map<String, Object> meta = new LinkedHashMap<>();
                meta.put("platform", platform);
                meta.put("owner", owner);
                meta.put("repo", repo);
                meta.put("ref", ref);
                meta.put("sha", node.path("sha").asText());
                meta.put("source", "git");

                out.add(IngestRequest.builder()
                        .id("git:" + platform + ":" + owner + "/" + repo + ":" + nodePath)
                        .sourceType(DataSourceType.GIT)
                        .sourceId(sourceId)
                        .content(md)
                        .contentType("text/markdown")
                        .workspace(workspace)
                        .title(nodePath)
                        .sourceUrl(String.format("%s/%s/%s/blob/%s/%s",
                                base.replace("api.", "").replace("/api/v3", ""), owner, repo, ref, nodePath))
                        .path(nodePath)
                        .category("git")
                        .metadata(meta)
                        .build());
            }
        }
        log.info("GitSource [{}] 从 {}:{}/{} 拉取 {} 个 Markdown", sourceId, platform, owner, repo, out.size());
        return out;
    }

    private String getBase(String platform) {
        switch (platform) {
            case "gitlab": return "https://gitlab.com/api/v4";
            case "gitee":  return "https://gitee.com/api/v5";
            default:        return "https://api.github.com";
        }
    }
}