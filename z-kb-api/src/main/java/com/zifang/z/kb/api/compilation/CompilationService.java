package com.zifang.z.kb.api.compilation;

import com.zifang.z.kb.api.resource.KbCaller;

import java.util.List;

/**
 * 编译编排。作业冻结输入，阶段按 P0–P4 执行，检索块与产物挂在物料版本上。
 *
 * <p>z-kb 没有独立任务内核，阶段在请求内同步执行并落库；接口形状、状态机与里程碑口径
 * 对齐参考实现。</p>
 */
public interface CompilationService {

    /** 触发单个物料版本编译：复用已完成或运行中的作业，否则新建并执行。 */
    CompilationJobView run(String materialId, String versionId, KbCaller caller);

    /** 按范围发起一次编译，多个物料共用同一作业，每个文件各自一组阶段。 */
    CompilationJobView runScope(CompilationScopeParam param, KbCaller caller);

    /** 按指定起始阶段重跑已结束的作业，轮次 +1 后重新执行，旧轮次明细保留。 */
    CompilationJobView retry(String jobId, String startStage, KbCaller caller);

    /** 取消编译作业：未终态阶段全部取消，已结束的作业原样返回。 */
    CompilationJobView cancel(String jobId, KbCaller caller);

    /** 按物料及可选版本查询最近的编译作业，不存在时返回 null。 */
    CompilationJobView queryByMaterial(String materialId, String versionId, KbCaller caller);

    /** 按作业标识查询编译详情，并校验知识库可读权限。 */
    CompilationJobView queryByJobId(String jobId, KbCaller caller);

    /** 列出作业冻结的输入条目，用于多文件作业展示成员与标题。 */
    List<CompilationScopeView> listScope(String jobId, KbCaller caller);

    /** 列出知识库下最近的编译作业，可按物料过滤。 */
    List<CompilationJobView> listByKb(String kbId, String materialId, int limit, KbCaller caller);

    /** 列出物料版本已生成的段落块。 */
    List<RetrievalChunkView> listChunks(String materialId, String versionId, int limit, KbCaller caller);

    /** 在知识库已索引的检索块中按关键词做词法检索。 */
    List<RetrievalChunkView> search(String kbId, String keyword, int limit, KbCaller caller);
}
