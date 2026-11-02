package com.zifang.z.kb.api.material;

import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.PageResult;

import java.util.List;

/**
 * 物料登记与查询。物料是原始材料的唯一事实源，编译产物不在本服务。
 *
 * <p>所有方法显式接收 {@link KbCaller}，服务内部不读线程上下文；跨租户或越权访问抛
 * KB_NOT_FOUND / MATERIAL_NOT_FOUND / MATERIAL_FORBIDDEN。</p>
 */
public interface MaterialService {

    /** 按知识库分页查询未删除资料，支持关键字/类型/状态/分类（含子分类）过滤。 */
    PageResult<MaterialView> page(String kbId, MaterialQuery query, KbCaller caller);

    /** 批量上传文件登记为资料，按内容指纹去重并投递解析任务，返回逐项结果。 */
    List<MaterialUploadItem> upload(String kbId, String categoryId, List<MaterialUploadFile> files,
            KbCaller caller);

    /** 把会话附件写入原始文件存储，返回地址与元数据；登记资料时再按地址引用。 */
    MaterialAttachment uploadAttachment(String kbId, String fileName, byte[] content, KbCaller caller);

    /** 把一段文本（通常为 Markdown）登记为资料，文件名由标题派生。 */
    MaterialUploadItem registerText(String kbId, String title, String categoryId, String content,
            KbCaller caller);

    /** 把原始文件存储里的附件登记为资料，地址须由 {@link #uploadAttachment} 返回。 */
    MaterialUploadItem registerFromUrl(String kbId, String title, String fileName, String categoryId,
            String url, KbCaller caller);

    /** 查询资料详情：资料主体、全部历史版本与当前版本解析稿。 */
    MaterialDetail detail(String materialId, KbCaller caller);

    /** 读取代码仓库物料的来源坐标（接入源绑定与同步元数据），供项目文件只读浏览。 */
    MaterialRepoRef repoRef(String materialId, KbCaller caller);

    /** 列出知识库内最近登记的资料（排除已删除），数量受 limit 限制。 */
    List<MaterialView> listRecent(String kbId, int limit, KbCaller caller);

    /** 批量调整资料分类，返回每个资料的成功标记与提示。 */
    List<MaterialBatchItem> updateCategory(String kbId, List<String> materialIds, String categoryId,
            KbCaller caller);

    /** 批量软删除资料，返回每个资料的成功标记与提示。 */
    List<MaterialBatchItem> remove(String kbId, List<String> materialIds, KbCaller caller);

    /** 下载指定版本（为空则取当前版本）的原始文件，返回文件名与字节内容。 */
    MaterialDownload download(String materialId, String versionId, KbCaller caller);

    /** 上传文件作为资料的新版本：指纹去重、版本号递增并投递解析任务，返回登记结果。 */
    MaterialUploadItem revise(String kbId, String materialId, MaterialUploadFile file,
            String sourceVersion, KbCaller caller);

    /** 重新解析指定版本（为空则取当前版本），生成新解析稿并更新版本解析状态。 */
    ParsedDraftView reparse(String materialId, String versionId, KbCaller caller);

    /** 对指定版本执行解析并写入新解析稿，供解析调度任务回调；失败时解析稿记录失败原因。 */
    ParsedDraftView parseVersion(String materialId, String versionId, KbCaller caller);

    /** 保存人工编辑后的解析稿正文：新建 READY 解析稿并指向该版本，旧稿保留。 */
    ParsedDraftView saveDraftText(String materialId, String versionId, String textContent,
            KbCaller caller);

    /** 列出指定版本（为空则取当前版本）的全部解析稿。 */
    List<ParsedDraftView> listDrafts(String materialId, String versionId, KbCaller caller);

    /** 批量从回收站恢复资料，返回每个资料的成功标记与提示。 */
    List<MaterialBatchItem> restore(String kbId, List<String> materialIds, KbCaller caller);

    /** 分页查询回收站中的资料，支持标题关键字过滤。 */
    PageResult<MaterialView> pageDeleted(String kbId, String keyword, long current, long size,
            KbCaller caller);

    /** 彻底删除回收站资料：物理删除本体与派生数据，原始文件在事务提交后清理。 */
    List<MaterialBatchItem> purge(String kbId, List<String> materialIds, KbCaller caller);

    /** 装载编译所需资料源：优先返回 READY 解析稿正文，否则回退到最新解析稿并附失败原因。 */
    MaterialCompileSource loadCompileSource(String materialId, String versionId, KbCaller caller);

    /** 接入源同步登记：materialId 为空则新建物料，非空则追加版本；内容未变时返回 UNCHANGED。 */
    MaterialSyncResult syncUpsert(MaterialSyncRequest request, KbCaller caller);

    /** 按接入源绑定标识列出已登记资料，供同步定位已有物料并读回上次同步元数据。 */
    List<MaterialBinding> listBySource(String kbId, String sourceBindingId, KbCaller caller);
}
