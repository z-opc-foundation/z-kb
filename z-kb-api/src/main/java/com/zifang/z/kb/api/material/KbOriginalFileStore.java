package com.zifang.z.kb.api.material;

/**
 * 原始文件存储 SPI。物料版本与附件只保存存储地址，不保存字节。
 *
 * <p>默认实现为本地文件系统；宿主可提供 OSS/S3 实现覆盖默认 Bean。
 * 地址在库内以 {@code URL} 形式保存，实现须保证同一地址可被 {@link #load(String)} 读回。</p>
 */
public interface KbOriginalFileStore {

    /** 存放物料版本的原始文件，返回可长期引用的地址。 */
    String store(String kbId, String versionId, String fileName, byte[] content);

    /** 存放会话附件，返回可长期引用的地址；附件不绑定物料版本。 */
    String storeAttachment(String kbId, String fileName, byte[] content);

    /** 按地址读回原始文件字节；地址不存在时抛 MATERIAL_NOT_FOUND。 */
    byte[] load(String url);

    /** 物理删除原始文件；地址为空或删除失败时静默忽略。 */
    void deleteQuietly(String url);
}
