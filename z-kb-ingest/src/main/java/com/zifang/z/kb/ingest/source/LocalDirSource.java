package com.zifang.z.***REMOVED***.ingest.source;

import com.zifang.z.***REMOVED***.api.source.LocalDirScanner;
import com.zifang.z.***REMOVED***.ingest.api.DataSource;
import com.zifang.z.***REMOVED***.ingest.api.DataSourceType;
import com.zifang.z.***REMOVED***.ingest.api.IngestRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 本地目录数据源 — 扫描目录下所有 .md 文件并产出 IngestRequest。
 *
 * <p>支持：
 * <ul>
 *   <li>递归扫描子目录</li>
 *   <li>跳过工具产物目录（排除清单与桌面端 note 同源）</li>
 *   <li>按 frontmatter 的 workspace 字段路由工作台</li>
 *   <li>幂等 ID 来自文件路径 hash</li>
 * </ul>
 *
 * <p><b>扫描口径不在本类。</b>本仓有两条路径都会扫本地目录：本管道层与接入源层
 * （{@code LocalIngestConnector}）。两者常指向同一批文件夹（桌面端 note 的工作区），
 * 各写一份就会漂移 —— 一边排除了 {@code .worktrees}、另一边没排除，同一篇笔记就在
 * 两处各存一份。所以扫描与排除清单都实现在 {@link LocalDirScanner}，这里只做
 * 「管道协议 ↔ 扫描结果」的翻译。
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
        int limit = (int) config.getOrDefault("limit", LocalDirScanner.DEFAULT_LIMIT);
        log.info("LocalDirSource [{}] 扫描目录 {} recursive={}, limit={}", sourceId, dirPath, recursive, limit);

        Path root = Paths.get(dirPath);
        List<LocalDirScanner.LocalDoc> docs = LocalDirScanner.scan(root, recursive, limit);
        log.info("LocalDirSource [{}] 扫描 {} 个 Markdown 文件（limit={}）", sourceId, docs.size(), limit);

        List<IngestRequest> result = new ArrayList<>();
        for (LocalDirScanner.LocalDoc doc : docs) {
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("absolutePath", doc.getAbsolutePath());
            meta.put("size", doc.getSize());
            meta.put("version", doc.getVersion());

            result.add(IngestRequest.builder()
                    .id("local:" + doc.getRelativePath())
                    .sourceType(DataSourceType.LOCAL_DIR)
                    .sourceId(sourceId)
                    .content(doc.getContent())
                    .contentType("text/markdown")
                    .workspace(workspace)
                    .title(doc.getTitle())
                    .path(doc.getRelativePath())
                    .sourceUrl("file://" + doc.getAbsolutePath())
                    .metadata(meta)
                    .build());
        }
        return result;
    }
}
