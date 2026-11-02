package com.zifang.z.kb.resource.source;

import com.zifang.util.json.JsonUtil;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceAccess;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceProvider;
import com.zifang.z.kb.core.source.IngestDocContent;
import com.zifang.z.kb.core.source.IngestDocRef;
import com.zifang.z.kb.core.source.IngestSyncInfo;
import com.zifang.z.kb.api.source.LocalDirScanPolicy;
import com.zifang.z.kb.api.source.LocalDirScanner;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 本地目录 → 物料。一个目录一个接入源：目录下每篇 Markdown 登记成一条物料，
 * 挂在接入源节点下的「本地目录」子节点上。
 *
 * <p><b>这解决的是「谁把文件放进去」这件事。</b>语雀、Git 这些接入源都要人去网页上
 * 上传或推代码；本地接入源的口径是：<b>文件出现在目录里，就已经在库里了</b>。
 * 桌面端 note 的工作区因此可以直接配成 z-kb 的接入源 —— note 侧负责写文件，
 * z-kb 侧负责吸收成可检索的知识，两边看同一批文件。
 *
 * <p><b>增量口径用内容指纹。</b>版本取文件内容的 SHA-256，不用修改时间 ——
 * mtime 在复制文件、同步盘拉取时会变，拿它当版本会让「内容没变」被误判成
 * 「已更新」，每次同步都重写一遍物料。
 *
 * <p><b>扫描口径与桌面端 note 同源。</b>排除清单见
 * {@link LocalDirScanPolicy#EXCLUDED_DIRS}，源头在 note 仓。
 */
public class LocalIngestConnector implements IngestConnector {

    /** 同步范围标识：写进物料元数据与回执，表示「哪个目录」。 */
    private static final String SCOPE = "local-dir";

    private static final String SOURCE_TYPE = "LOCAL";

    private final DocIngestRunner runner;

    private final SourceTreeNodes sourceTreeNodes;

    public LocalIngestConnector(DocIngestRunner runner, SourceTreeNodes sourceTreeNodes) {
        this.runner = runner;
        this.sourceTreeNodes = sourceTreeNodes;
    }

    @Override
    public KnowledgeBaseSourceProvider provider() {
        return KnowledgeBaseSourceProvider.LOCAL;
    }

    /** 本地接入源只需要一个能读的目录，不需要任何凭据。 */
    @Override
    public void checkScope(KnowledgeBaseSourceAccess source) {
        String dir = dir(source);
        if (dir == null) {
            throw new KBException("KB_SOURCE_CONFIG_INVALID", "本地接入源需要填写目录路径");
        }
        Path root = Paths.get(dir);
        if (!java.nio.file.Files.isDirectory(root)) {
            throw new KBException("KB_SOURCE_CONFIG_INVALID", "目录不存在或不是目录：" + dir);
        }
        if (!java.nio.file.Files.isReadable(root)) {
            throw new KBException("KB_SOURCE_CONFIG_INVALID", "目录不可读：" + dir);
        }
    }

    @Override
    public String inputSnapshot(KnowledgeBaseSourceAccess source) {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("sourceId", source.getSourceId());
        node.put("provider", source.getProvider());
        node.put("dir", dir(source));
        node.put("recursive", recursive(source));
        return JsonUtil.toJson(node);
    }

    @Override
    public IngestSyncInfo sync(String kbId, KnowledgeBaseSourceAccess source, KbCaller caller) {
        checkScope(source);
        Path root = Paths.get(dir(source)).toAbsolutePath().normalize();
        boolean recursive = recursive(source);

        List<LocalDirScanner.LocalDoc> docs;
        try {
            docs = LocalDirScanner.scan(root, recursive, LocalDirScanner.DEFAULT_LIMIT);
        } catch (IOException e) {
            throw new KBException("KB_SOURCE_CONFIG_INVALID", "扫描目录失败：" + e.getMessage());
        }

        String sourceCategoryId = sourceTreeNodes.ensureSourceNode(kbId, source, caller);
        String dirCategoryId = sourceTreeNodes.ensureLocalDirNode(kbId, sourceCategoryId, source,
                root.toString(), caller);

        // 文档清单：slug 用相对路径（幂等键），版本用内容指纹。
        List<IngestDocRef> refs = new ArrayList<>();
        Map<String, String> versions = new LinkedHashMap<>();
        for (LocalDirScanner.LocalDoc doc : docs) {
            refs.add(new IngestDocRef(doc.getRelativePath(), doc.getTitle(), doc.getVersion(),
                    doc.getRelativePath(), 0, SCOPE, dirCategoryId));
            versions.put(doc.getRelativePath(), doc.getVersion());
        }

        // 正文已在扫描时读进来了，按 slug 回查即可 —— 不再二次读盘。
        Map<String, LocalDirScanner.LocalDoc> bySlug = new LinkedHashMap<>();
        for (LocalDirScanner.LocalDoc doc : docs) {
            bySlug.put(doc.getRelativePath(), doc);
        }

        return runner.run(kbId, source.getSourceId(), SOURCE_TYPE, SCOPE, refs, versions,
                ref -> {
                    LocalDirScanner.LocalDoc doc = bySlug.get(ref.getSlug());
                    if (doc == null) {
                        return null;
                    }
                    return new IngestDocContent(doc.getContent(), doc.getVersion(), doc.getVersion());
                }, caller);
    }

    private static String dir(KnowledgeBaseSourceAccess source) {
        return source.scopeValue("path");
    }

    private static boolean recursive(KnowledgeBaseSourceAccess source) {
        Object value = source.getScope() == null ? null : source.getScope().get("recursive");
        if (value == null) {
            return true;
        }
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        return Boolean.parseBoolean(String.valueOf(value));
    }
}
