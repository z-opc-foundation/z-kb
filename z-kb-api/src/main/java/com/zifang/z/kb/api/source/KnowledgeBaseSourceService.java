package com.zifang.z.kb.api.source;

import com.zifang.z.kb.api.resource.KbCaller;

import java.util.List;

/**
 * 知识库接入源：列表 / 保存 / 连通性探测 / 语雀可选项加载。
 *
 * <p>同步执行不在本接口：见 {@link IngestService}。所有方法显式接收 {@link KbCaller}，
 * 越权或跨租户访问抛 KB_NOT_FOUND / KB_FORBIDDEN / KB_ACTION_FORBIDDEN。</p>
 */
public interface KnowledgeBaseSourceService {

    /** 按知识库查询接入源配置，凭据不返回明文。 */
    List<KnowledgeBaseSourceView> listSources(String kbId, KbCaller caller);

    /** 全量覆盖保存接入源列表，返回保存后的列表；传空列表表示清空。 */
    List<KnowledgeBaseSourceView> saveSources(KnowledgeBaseSourceSaveParam param, KbCaller caller);

    /** 探测单条接入源能否连通，不落库、不产生任务。 */
    KnowledgeBaseSourceTestView testConnection(KnowledgeBaseSourceTestParam param, KbCaller caller);

    /** 加载语雀团队空间与知识库，供接入源填写范围。 */
    KnowledgeBaseSourceCatalogView catalog(KnowledgeBaseSourceCatalogParam param, KbCaller caller);

    /** 加载某个语雀知识库的文章列表，供勾选到文章级。 */
    KnowledgeBaseSourceDocListView catalogDocs(KnowledgeBaseSourceCatalogDocsParam param,
            KbCaller caller);

    /** 取同步执行用的完整配置，要求 KB_MANAGE。 */
    KnowledgeBaseSourceAccess requireAccess(String kbId, String sourceId, KbCaller caller);

    /** 取只读浏览用的完整配置，要求 KB_READ。 */
    KnowledgeBaseSourceAccess requireReadAccess(String kbId, String sourceId, KbCaller caller);
}
