package com.zifang.z.kb.resource.material;

import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.material.MaterialRepoBrowseService;
import com.zifang.z.kb.api.material.MaterialRepoRef;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.material.RepoEntry;
import com.zifang.z.kb.api.material.RepoFile;
import com.zifang.z.kb.api.material.RepoOverview;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.KbPaths;
import com.zifang.util.json.JsonUtil;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

/**
 * 代码仓库物料只读浏览。参考实现按接入源凭据实时读 Git；本实现读宿主配置的本地检出根目录
 * （{@code zkb.material.repo.root}），仓库坐标来自物料元数据 {@code kind=REPO, repo, branch, commit}。
 *
 * <p>尚未配置根目录或物料不是仓库类型时抛 MATERIAL_REPO_UNSUPPORTED；路径只接受仓库内相对路径。</p>
 */
public class DefaultMaterialRepoBrowseService implements MaterialRepoBrowseService {

    private static final String META_KIND_REPO = "REPO";
    private static final int MAX_FILE_CHARS = 200_000;
    private static final int MAX_SCAN_FILES = 5000;

    private static final Set<String> DOC_EXTS = setOf(
            "md", "markdown", "txt", "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx",
            "csv", "rtf", "html", "htm", "adoc", "rst", "log");
    private static final Set<String> CODE_EXTS = setOf(
            "py", "java", "js", "jsx", "ts", "tsx", "go", "rs", "c", "h", "cpp", "hpp", "cs", "rb",
            "php", "sh", "bash", "sql", "yaml", "yml", "xml", "toml", "kt", "swift", "scala", "lua",
            "css", "scss", "less", "vue", "svelte");

    private static final Comparator<RepoEntry> ENTRY_ORDER = (left, right) -> {
        if (left.isDirectory() != right.isDirectory()) {
            return left.isDirectory() ? -1 : 1;
        }
        return left.getName().compareToIgnoreCase(right.getName());
    };

    private final MaterialService materialService;
    private final Path repoRoot;

    public DefaultMaterialRepoBrowseService(MaterialService materialService, String repoRoot) {
        this.materialService = materialService;
        String expanded = KbPaths.expand(repoRoot);
        this.repoRoot = expanded == null ? null : Paths.get(expanded).toAbsolutePath().normalize();
    }

    @Override
    public RepoOverview overview(String materialId, KbCaller caller) {
        RepoRef ref = resolve(materialId, caller);
        RepoOverview overview = new RepoOverview();
        overview.setMaterialId(ref.material.getMaterialId());
        overview.setTitle(ref.material.getTitle());
        overview.setProvider(hasText(ref.material.getSourceType()) ? ref.material.getSourceType() : "LOCAL");
        overview.setRepo(ref.repo);
        overview.setRepoUrl(repoRoot.toUri().toString());
        overview.setBranch(ref.branch);
        overview.setCommit(ref.commit);

        int[] counts = countFiles(ref.dir);
        overview.setFileCount(counts[0]);
        overview.setDocCount(counts[1]);
        overview.setCodeCount(counts[2]);
        overview.setEntries(loadEntries(ref.dir, null));
        return overview;
    }

    @Override
    public List<RepoEntry> listEntries(String materialId, String path, KbCaller caller) {
        RepoRef ref = resolve(materialId, caller);
        Path dir = resolveInside(ref, path);
        if (!Files.isDirectory(dir)) {
            throw new KBException("MATERIAL_REPO_PATH_INVALID", "仓库目录不存在：" + path);
        }
        return loadEntries(dir, normalizePath(path));
    }

    @Override
    public RepoFile readFile(String materialId, String path, KbCaller caller) {
        if (!hasText(path)) {
            throw new KBException("MATERIAL_REPO_PATH_INVALID", "文件路径不能为空");
        }
        RepoRef ref = resolve(materialId, caller);
        String filePath = normalizePath(path);
        Path file = resolveInside(ref, filePath);
        if (!Files.isRegularFile(file)) {
            throw new KBException("MATERIAL_REPO_PATH_INVALID", "仓库文件不存在：" + path);
        }
        byte[] bytes;
        try {
            bytes = Files.readAllBytes(file);
        } catch (IOException e) {
            throw new KBException("MATERIAL_REPO_READ_FAILED", "读取仓库文件失败：" + e.getMessage(), e);
        }
        RepoFile result = new RepoFile();
        result.setPath(filePath);
        result.setName(nameOf(filePath));
        result.setFileExt(extension(filePath));
        result.setSizeBytes((long) bytes.length);
        if (isBinary(bytes)) {
            result.setBinary(true);
            return result;
        }
        String text = new String(bytes, StandardCharsets.UTF_8);
        if (text.length() > MAX_FILE_CHARS) {
            result.setTruncated(true);
            text = text.substring(0, MAX_FILE_CHARS);
        }
        result.setContent(text);
        return result;
    }

    private RepoRef resolve(String materialId, KbCaller caller) {
        MaterialRepoRef material = materialService.repoRef(materialId, caller);
        Map<String, Object> meta = parseMeta(material.getMetadata());
        if (!META_KIND_REPO.equals(String.valueOf(meta.get("kind")))) {
            throw new KBException("MATERIAL_REPO_UNSUPPORTED", "该物料不是仓库类型，无法浏览文件");
        }
        if (repoRoot == null) {
            throw new KBException("MATERIAL_REPO_UNSUPPORTED",
                    "未配置 zkb.material.repo.root，仓库浏览不可用");
        }
        Object repoValue = meta.get("repo");
        String repo = repoValue == null ? "" : String.valueOf(repoValue).trim();
        if (!hasText(repo)) {
            throw new KBException("MATERIAL_REPO_UNSUPPORTED", "物料元数据缺少仓库坐标 repo");
        }
        Path dir = repoRoot.resolve(repo).normalize();
        if (!dir.startsWith(repoRoot) || !Files.isDirectory(dir)) {
            throw new KBException("MATERIAL_REPO_UNSUPPORTED", "仓库未在本地检出：" + repo);
        }
        RepoRef ref = new RepoRef();
        ref.material = material;
        ref.repo = repo;
        ref.dir = dir;
        ref.branch = text(meta.get("branch"));
        ref.commit = text(meta.get("commit"));
        return ref;
    }

    private List<RepoEntry> loadEntries(Path dir, String parentPath) {
        List<RepoEntry> entries = new ArrayList<>();
        try (Stream<Path> stream = Files.list(dir)) {
            stream.forEach(child -> {
                RepoEntry entry = new RepoEntry();
                String name = child.getFileName().toString();
                entry.setName(name);
                entry.setPath(parentPath == null ? name : parentPath + "/" + name);
                entry.setEntryType(Files.isDirectory(child) ? RepoEntry.TYPE_DIR : RepoEntry.TYPE_FILE);
                entries.add(entry);
            });
        } catch (IOException e) {
            throw new KBException("MATERIAL_REPO_READ_FAILED", "列出仓库目录失败：" + e.getMessage(), e);
        }
        entries.sort(ENTRY_ORDER);
        return entries;
    }

    /** 统计文件总数、文档数与代码数；超过扫描上限时按已扫描结果返回。 */
    private int[] countFiles(Path dir) {
        int[] counts = new int[3];
        try (Stream<Path> stream = Files.walk(dir)) {
            stream.filter(Files::isRegularFile).limit(MAX_SCAN_FILES).forEach(file -> {
                counts[0]++;
                String ext = extension(file.getFileName().toString());
                if (DOC_EXTS.contains(ext)) {
                    counts[1]++;
                } else if (CODE_EXTS.contains(ext)) {
                    counts[2]++;
                }
            });
        } catch (IOException ignored) {
            // 统计失败不影响概览的其他字段
        }
        return counts;
    }

    /** 只接受仓库内相对路径，拒绝绝对路径与任意层级回退。 */
    private Path resolveInside(RepoRef ref, String path) {
        String normalized = normalizePath(path);
        Path target = normalized == null ? ref.dir : ref.dir.resolve(normalized).normalize();
        if (!target.startsWith(ref.dir)) {
            throw new KBException("MATERIAL_REPO_PATH_INVALID", "仓库路径非法：" + path);
        }
        return target;
    }

    private static String normalizePath(String path) {
        if (!hasText(path)) {
            return null;
        }
        String value = path.trim().replace('\\', '/');
        while (value.startsWith("/")) {
            value = value.substring(1);
        }
        if (value.isEmpty()) {
            return null;
        }
        for (String segment : value.split("/")) {
            if (segment.isEmpty() || ".".equals(segment) || "..".equals(segment)) {
                throw new KBException("MATERIAL_REPO_PATH_INVALID", "仓库路径非法：" + path);
            }
        }
        return value;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> parseMeta(String metadata) {
        if (!hasText(metadata)) {
            return java.util.Collections.emptyMap();
        }
        try {
            Object plain = JsonUtil.toPlainValue(JsonUtil.parse(metadata));
            if (plain instanceof Map) {
                return (Map<String, Object>) plain;
            }
        } catch (RuntimeException ignored) {
            // 元数据损坏按非仓库物料处理
        }
        return java.util.Collections.emptyMap();
    }

    private static boolean isBinary(byte[] bytes) {
        int limit = Math.min(bytes.length, 8000);
        for (int i = 0; i < limit; i++) {
            if (bytes[i] == 0) {
                return true;
            }
        }
        return false;
    }

    private static String text(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static String nameOf(String path) {
        int slash = path.lastIndexOf('/');
        return slash >= 0 ? path.substring(slash + 1) : path;
    }

    private static String extension(String name) {
        int dot = name.lastIndexOf('.');
        return dot <= 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private static Set<String> setOf(String... values) {
        return Collections.unmodifiableSet(new HashSet<>(Arrays.asList(values)));
    }

    private static final class RepoRef {

        private MaterialRepoRef material;
        private String repo;
        private Path dir;
        private String branch;
        private String commit;
    }
}
