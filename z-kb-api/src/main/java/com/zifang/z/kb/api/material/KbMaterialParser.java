package com.zifang.z.kb.api.material;

/**
 * 原始文件解析 SPI。默认实现只处理 UTF-8 文本类文件；宿主可提供 PDF/Office 等实现。
 *
 * <p>解析结果不抛异常，失败通过 {@link KbParsedText#failed(String, String, String)} 返回，
 * 便于物料侧把失败原因落成解析稿。</p>
 */
public interface KbMaterialParser {

    /** 是否处理该文件名（通常按扩展名判定）。 */
    boolean supports(String fileName);

    /** 解析文件内容；实现不得依赖调用线程上下文。 */
    KbParsedText parse(String fileName, byte[] content);
}
