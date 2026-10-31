package com.zifang.z.***REMOVED***.api.compilation;

import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;

import java.util.List;

/**
 * 编译组别编排。一个组别就是一次多文件编译作业，成员是各文件的一组阶段。
 */
public interface CompilationBatchService {

    /** 创建编译组别：按物料多选或分类范围建一个多文件作业。 */
    CompilationBatchView create(CompilationBatchCreateParam param, ***REMOVED***Caller caller);

    /** 取消组别内所有未终态阶段。 */
    CompilationBatchView cancel(String batchId, ***REMOVED***Caller caller);

    /** 查询组别详情，成员状态取各文件的阶段结果。 */
    CompilationBatchView query(String batchId, ***REMOVED***Caller caller);

    /** 列出知识库下最近的编译组别，不含成员。 */
    List<CompilationBatchView> listBy***REMOVED***(String ***REMOVED***Id, int limit, ***REMOVED***Caller caller);

    /** 分页查询知识库下的编译组别。 */
    CompilationBatchPageView pageBy***REMOVED***(String ***REMOVED***Id, int pageNo, int pageSize, ***REMOVED***Caller caller);

    /** 判断知识库是否已有运行中的组别，用于阻止重复提交。 */
    boolean hasRunning(String ***REMOVED***Id, ***REMOVED***Caller caller);
}
