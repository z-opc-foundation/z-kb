package com.zifang.z.kb.resource.material;

import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.KbPaths;
import com.zifang.z.kb.api.material.KbOriginalFileStore;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.UUID;

/**
 * 原始文件存储的本地文件系统实现：物料版本按 kb/版本分目录，附件按 kb + 随机目录落盘。
 *
 * <p>库内只保存地址，不保存字节。返回的地址带 {@code file:} 前缀，{@link #load(String)}
 * 同时接受带前缀与纯路径两种形态；多机部署时需宿主提供共享存储（OSS/S3）实现覆盖本默认 Bean。</p>
 */
public class LocalKbOriginalFileStore implements KbOriginalFileStore {

    private static final String FILE_SCHEME = "file:";
    private static final String UNBOUND = "_unbound";
    private static final String ATTACHMENTS = "_attachments";

    private final Path root;

    public LocalKbOriginalFileStore(String rootDir) {
        String expanded = KbPaths.expand(rootDir);
        this.root = Paths.get(expanded == null ? KbPaths.stateDir() + "/material-original" : expanded)
                .toAbsolutePath().normalize();
    }

    @Override
    public String store(String kbId, String versionId, String fileName, byte[] content) {
        Path dir = root.resolve(segment(kbId, UNBOUND)).resolve(segment(versionId, UNBOUND));
        return write(dir, fileName, content);
    }

    @Override
    public String storeAttachment(String kbId, String fileName, byte[] content) {
        Path dir = root.resolve(ATTACHMENTS).resolve(segment(kbId, UNBOUND))
                .resolve(UUID.randomUUID().toString());
        return write(dir, fileName, content);
    }

    @Override
    public byte[] load(String url) {
        Path file = resolve(url);
        if (!Files.isRegularFile(file)) {
            throw new KBException("MATERIAL_NOT_FOUND", "原始文件不存在或已清理");
        }
        try {
            return Files.readAllBytes(file);
        } catch (IOException e) {
            throw new KBException("MATERIAL_READ_FAILED", "读取原始文件失败：" + e.getMessage(), e);
        }
    }

    @Override
    public void deleteQuietly(String url) {
        if (url == null || url.trim().isEmpty()) {
            return;
        }
        try {
            Files.deleteIfExists(resolve(url));
        } catch (IOException | RuntimeException ignored) {
            // 清理失败不影响资料删除结果，残留文件由运维按根目录回收
        }
    }

    private String write(Path dir, String fileName, byte[] content) {
        String name = segment(fileName, "untitled");
        try {
            Files.createDirectories(dir);
            Path file = dir.resolve(name);
            Files.write(file, content, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING,
                    StandardOpenOption.WRITE);
            return FILE_SCHEME + file.toString();
        } catch (IOException e) {
            throw new KBException("MATERIAL_STORAGE_FAILED", "写入原始文件失败：" + e.getMessage(), e);
        }
    }

    /** 地址还原为根目录下的文件；解析结果越出根目录时按不存在处理，防目录穿越。 */
    private Path resolve(String url) {
        String value = url == null ? "" : url.trim();
        if (value.startsWith(FILE_SCHEME)) {
            value = value.substring(FILE_SCHEME.length());
        }
        Path file = Paths.get(value).toAbsolutePath().normalize();
        if (!file.startsWith(root)) {
            throw new KBException("MATERIAL_NOT_FOUND", "原始文件地址非法");
        }
        return file;
    }

    private static String segment(String value, String fallback) {
        String text = value == null ? "" : value.trim();
        int slash = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\'));
        if (slash >= 0) {
            text = text.substring(slash + 1);
        }
        return text.isEmpty() || ".".equals(text) || "..".equals(text) ? fallback : text;
    }
}
