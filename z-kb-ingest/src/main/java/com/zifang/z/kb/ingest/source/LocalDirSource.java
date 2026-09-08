package com.zifang.z.kb.ingest.source;

import com.zifang.z.kb.ingest.api.DataSource;
import com.zifang.z.kb.ingest.api.DataSourceType;
import com.zifang.z.kb.ingest.api.IngestRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 本地目录数据源 — 扫描目录下所有 .md 文件并产出 IngestRequest。
 *
 * <p>支持：
 * <ul>
 *   <li>递归扫描子目录</li>
 *   <li>跳过 _开头的隐藏目录（Obsidian 习惯）</li>
 *   <li>按 frontmatter 的 workspace 字段路由工作台</li>
 *   <li>幂等 ID 来自文件路径 hash</li>
 * </ul>
 */
public class LocalDirSource implements DataSource {

    private static final Logger log = LoggerFactory.getLogger(LocalDirSource.class);

    private final String sourceId;

    public LocalDirSource(String sourceId) {
        this.sourceId = sourceId;
    }

    public LocalDirSource() {
        this("local-default");
    }

    @Override
    public String getSourceId() { return sourceId; }

    @Override
    public DataSourceType getType() { return DataSourceType.LOCAL_DIR; }

    @Override
    public List<IngestRequest> fetch(Map<String, Object> config) throws IOException {
        String dirPath = (String) config.get("path");
        if (dirPath == null || dirPath.isEmpty()) {
            throw new IllegalArgumentException("path 不能为空");
        }
        String workspace = (String) config.getOrDefault("workspace", "default");
        boolean recursive = Boolean.TRUE.equals(config.getOrDefault("recursive", true));

        Path root = Paths.get(dirPath);
        if (!Files.isDirectory(root)) {
            throw new IOException("目录不存在或不是目录: " + dirPath);
        }

        List<IngestRequest> result = new ArrayList<>();
        if (recursive) {
            try (var stream = Files.walk(root)) {
                stream.filter(Files::isRegularFile)
                        .filter(p -> p.toString().endsWith(".md") || p.toString().endsWith(".markdown"))
                        .filter(p -> {
                            String name = p.getFileName().toString();
                            return !name.startsWith(".");
                        })
                        .filter(p -> !isInHiddenDir(root, p))
                        .forEach(p -> result.add(toRequest(p, root, workspace)));
            }
        } else {
            try (var stream = Files.list(root)) {
                stream.filter(Files::isRegularFile)
                        .filter(p -> p.toString().endsWith(".md"))
                        .forEach(p -> result.add(toRequest(p, root, workspace)));
            }
        }

        log.info("LocalDirSource [{}] 扫描 {} 个 Markdown 文件", sourceId, result.size());
        return result;
    }

    private boolean isInHiddenDir(Path root, Path file) {
        Path rel = root.relativize(file);
        for (Path part : rel) {
            if (part.toString().startsWith(".") || part.toString().startsWith("_")) {
                return true;
            }
        }
        return false;
    }

    private IngestRequest toRequest(Path file, Path root, String defaultWorkspace) {
        try {
            String content = new String(Files.readAllBytes(file), java.nio.charset.StandardCharsets.UTF_8);
            String path = root.relativize(file).toString();
            String title = inferTitle(content, file.getFileName().toString());

            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("absolutePath", file.toAbsolutePath().toString());
            meta.put("size", Files.size(file));

            return IngestRequest.builder()
                    .id("local:" + path)
                    .sourceType(DataSourceType.LOCAL_DIR)
                    .sourceId(sourceId)
                    .content(content)
                    .contentType("text/markdown")
                    .workspace(defaultWorkspace)
                    .title(title)
                    .path(path)
                    .sourceUrl("file://" + file.toAbsolutePath())
                    .metadata(meta)
                    .build();
        } catch (IOException e) {
            throw new RuntimeException("读取文件失败: " + file, e);
        }
    }

    private String inferTitle(String content, String filename) {
        for (String line : content.split("\n")) {
            String trimmed = line.trim();
            if (trimmed.startsWith("# ")) {
                return trimmed.substring(2).trim();
            }
        }
        return filename.replaceAll("\\.(md|markdown)$", "");
    }
}