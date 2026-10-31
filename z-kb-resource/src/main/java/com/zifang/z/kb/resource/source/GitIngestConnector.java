package com.zifang.z.kb.resource.source;

import com.zifang.util.json.JsonUtil;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.material.MaterialBatchItem;
import com.zifang.z.kb.api.material.MaterialBinding;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.material.MaterialSyncRequest;
import com.zifang.z.kb.api.material.MaterialSyncResult;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceAccess;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceProvider;
import com.zifang.z.kb.core.source.GitRepoDigest;
import com.zifang.z.kb.core.source.IngestMetadata;
import com.zifang.z.kb.core.source.IngestSyncInfo;
import com.zifang.z.kb.core.source.git.GitApiClient;
import com.zifang.z.kb.core.source.git.GitApiException;
import com.zifang.z.kb.core.source.git.GitAuth;
import com.zifang.z.kb.core.source.git.GitFileNode;
import com.zifang.z.kb.core.source.git.GitRepoUrl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Git 仓库 → 仓库物料：一个项目只登记一条物料（sourceType=CODE_GIT），commit 作源版本；
 * 正文是「文件结构 + README + 文本类文档」的 Markdown 摘要，代码本体仍留在 Git。
 * 旧版按文件登记的 GIT 物料在首次仓库同步后清退。
 */
public class GitIngestConnector implements IngestConnector {

    private static final Logger LOG = LoggerFactory.getLogger(GitIngestConnector.class);

    private static final String SOURCE_TYPE = "CODE_GIT";

    private static final String META_KIND_REPO = "REPO";

    private static final String DEFAULT_REF = "main";

    private static final int TREE_PAGE_SIZE = 100;

    private static final int MAX_TREE_PAGES = 50;

    private final GitApiClient gitApiClient;

    private final MaterialService materialService;

    private final SourceTreeNodes sourceTreeNodes;

    public GitIngestConnector(GitApiClient gitApiClient, MaterialService materialService,
            SourceTreeNodes sourceTreeNodes) {
        this.gitApiClient = gitApiClient;
        this.materialService = materialService;
        this.sourceTreeNodes = sourceTreeNodes;
    }

    @Override
    public KnowledgeBaseSourceProvider provider() {
        return KnowledgeBaseSourceProvider.GIT;
    }

    @Override
    public void checkScope(KnowledgeBaseSourceAccess source) {
        GitRepoUrl repo = GitRepoUrl.parse(repo(source));
        String secret = source.resolveSecret();
        if (repo == null || secret == null || secret.trim().isEmpty()
                || !gitApiClient.isHostAllowed(repo.getBaseUrl())) {
            throw new KBException("KB_SOURCE_CONFIG_INVALID",
                    "Git 接入源需要 HTTPS 仓库地址、凭据与允许的站点");
        }
    }

    @Override
    public String inputSnapshot(KnowledgeBaseSourceAccess source) {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("sourceId", source.getSourceId());
        node.put("provider", source.getProvider());
        node.put("repo", repo(source));
        node.put("ref", ref(source));
        node.put("path", path(source));
        return JsonUtil.toJson(node);
    }

    @Override
    public IngestSyncInfo sync(String kbId, KnowledgeBaseSourceAccess source, KbCaller caller) {
        checkScope(source);
        GitRepoUrl repo = GitRepoUrl.parse(repo(source));
        String ref = ref(source);
        GitAuth auth = GitAuth.of(source.getCredentialType(), source.getCredentialUsername(),
                source.resolveSecret());
        List<GitFileNode> tree = loadTree(repo, ref, auth);
        String commit = latestCommit(repo, ref, auth);
        String treeHash = treeHash(tree);
        String version = commit == null ? "tree:" + treeHash : commit;

        String sourceCategoryId = sourceTreeNodes.ensureSourceNode(kbId, source, caller);
        String repoCategoryId = sourceTreeNodes.ensureRepoNode(kbId, sourceCategoryId, source,
                repo.getProjectPath(), repo.getProjectPath(), ref, caller);

        List<MaterialBinding> bound = materialService.listBySource(kbId, source.getSourceId(),
                caller);
        MaterialBinding existing = findRepoMaterial(bound);

        IngestSyncInfo result = new IngestSyncInfo();
        if (existing != null && version.equals(
                IngestMetadata.field(existing.getMetadata(), "version"))) {
            result.markUnchanged();
            retireLegacyDocs(kbId, bound, result, caller);
            return result;
        }

        final String repoUrl = repo(source);
        final String baseUrl = repo.getBaseUrl();
        final String projectPath = repo.getProjectPath();
        GitRepoDigest.Result digest = GitRepoDigest.build(projectPath, repoUrl, ref, commit, tree,
                path(source), filePath -> gitApiClient.readRawFile(baseUrl, projectPath, filePath,
                        ref, auth));

        MaterialSyncRequest request = new MaterialSyncRequest();
        request.setKbId(kbId);
        request.setMaterialId(existing == null ? null : existing.getMaterialId());
        request.setCategoryId(repoCategoryId);
        request.setTitle(projectPath);
        request.setFileName(repo.getProjectName() + ".md");
        request.setContent(digest.getMarkdown().getBytes(StandardCharsets.UTF_8));
        request.setSourceType(SOURCE_TYPE);
        request.setSourceBindingId(source.getSourceId());
        request.setSourceVersion(version);
        request.setMetadata(repoMetadata(repo, ref, commit, treeHash, version, digest));

        MaterialSyncResult outcome = materialService.syncUpsert(request, caller);
        if (MaterialSyncResult.CREATED.equals(outcome.getStatus())) {
            result.markCreated();
        } else if (MaterialSyncResult.UPDATED.equals(outcome.getStatus())) {
            result.markUpdated();
        } else if (MaterialSyncResult.UNCHANGED.equals(outcome.getStatus())) {
            result.markUnchanged();
        } else {
            result.markFailed("《" + repo.getProjectPath() + "》" + outcome.getMessage());
            return result;
        }
        retireLegacyDocs(kbId, bound, result, caller);
        return result;
    }

    /** 旧版 Git 同步把每个文档登记成物料，切到仓库物料后统一清退，保证一个项目一个条目。 */
    private void retireLegacyDocs(String kbId, List<MaterialBinding> bound, IngestSyncInfo result,
            KbCaller caller) {
        for (MaterialBinding item : bound) {
            if (META_KIND_REPO.equals(IngestMetadata.field(item.getMetadata(), "kind"))) {
                continue;
            }
            if (IngestMetadata.field(item.getMetadata(), "docSlug") == null) {
                continue;
            }
            List<MaterialBatchItem> removed = materialService.remove(kbId,
                    Collections.singletonList(item.getMaterialId()), caller);
            if (!removed.isEmpty() && removed.get(0).isSuccess()) {
                result.markRetired();
            } else {
                result.markFailed("《" + item.getTitle() + "》清退失败");
            }
        }
    }

    /** 按物料元数据识别仓库物料；同一来源下最多一条。 */
    private MaterialBinding findRepoMaterial(List<MaterialBinding> bound) {
        for (MaterialBinding item : bound) {
            if (META_KIND_REPO.equals(IngestMetadata.field(item.getMetadata(), "kind"))) {
                return item;
            }
        }
        return null;
    }

    private String repoMetadata(GitRepoUrl repo, String ref, String commit, String treeHash,
            String version, GitRepoDigest.Result digest) {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("kind", META_KIND_REPO);
        node.put("provider", "GIT");
        node.put("repo", repo.getProjectPath());
        node.put("repoUrl", repo.getBaseUrl() + "/" + repo.getProjectPath());
        node.put("branch", ref);
        node.put("commit", commit);
        node.put("treeHash", treeHash);
        node.put("version", version);
        node.put("fileCount", digest.getFileCount());
        node.put("docCount", digest.getDocCount());
        node.put("codeCount", digest.getCodeCount());
        return JsonUtil.toJson(node);
    }

    /** 取分支最新提交；仓库为空或接口不返回提交时退回文件树指纹。 */
    private String latestCommit(GitRepoUrl repo, String ref, GitAuth auth) {
        try {
            return gitApiClient.latestCommit(repo.getBaseUrl(), repo.getProjectPath(), ref, auth);
        } catch (GitApiException e) {
            LOG.warn("Git 提交读取失败，改用文件树指纹 repo={} reason={}", repo.getProjectPath(),
                    e.getMessage());
            return null;
        }
    }

    private List<GitFileNode> loadTree(GitRepoUrl repo, String ref, GitAuth auth) {
        List<GitFileNode> all = new ArrayList<>();
        for (int page = 1; page <= MAX_TREE_PAGES; page++) {
            List<GitFileNode> batch = gitApiClient.listTree(repo.getBaseUrl(),
                    repo.getProjectPath(), ref, page, TREE_PAGE_SIZE, auth);
            all.addAll(batch);
            if (batch.size() < TREE_PAGE_SIZE) {
                break;
            }
        }
        return all;
    }

    /** 文件树指纹：路径 + blob id 排序后取 SHA-256，提交读不到时用它判断是否变化。 */
    private static String treeHash(List<GitFileNode> tree) {
        List<String> lines = new ArrayList<>();
        for (GitFileNode node : tree) {
            if (node.getPath() != null) {
                lines.add(node.getPath() + ":" + (node.getId() == null ? "" : node.getId()));
            }
        }
        Collections.sort(lines);
        StringBuilder joined = new StringBuilder();
        for (String line : lines) {
            joined.append(line).append('\n');
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(joined.toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16));
                hex.append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }

    private static String repo(KnowledgeBaseSourceAccess source) {
        return source.scopeValue("repo");
    }

    private static String ref(KnowledgeBaseSourceAccess source) {
        String branch = source.scopeValue("branch");
        return branch == null || branch.trim().isEmpty() ? DEFAULT_REF : branch.trim();
    }

    private static String path(KnowledgeBaseSourceAccess source) {
        return source.scopeValue("path");
    }
}
