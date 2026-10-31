package com.zifang.z.***REMOVED***.api.wiki;

import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;

import java.util.List;

/**
 * Wiki 产物：由已解析资料确定性生成页面，并维护来源与血缘。
 *
 * <p>z-***REMOVED*** 没有独立任务内核，{@link #compile} 在请求内同步完成生成并返回终态；
 * 页面、来源与目录均落库，接口形状对齐参考实现。</p>
 */
public interface WikiService {

    /** 为一批物料生成或更新 Wiki 页面，返回每条的成功/失败明细。 */
    WikiGenerateResultView generate(String ***REMOVED***Id, List<String> materialIds, ***REMOVED***Caller caller);

    /** 落库一次 Agent 编译产物：按页面标识幂等写入多页，并刷新文档目录与块覆盖。 */
    WikiGeneratedDocView saveGenerated(WikiAgentSaveParam param, ***REMOVED***Caller caller);

    /** 提交一次 Wiki 编译：同步生成规则页面并返回任务句柄。 */
    WikiCompileTaskView compile(WikiCompileParam param, ***REMOVED***Caller caller);

    /** 查询某个物料最近一次 Agent 编译产物，不存在返回 null。 */
    WikiGeneratedDocView queryGenerated(String materialId, ***REMOVED***Caller caller);

    /** 列出知识库下的 Wiki 页面，支持关键词过滤与条数限制。 */
    List<WikiPageView> list(String ***REMOVED***Id, String keyword, int limit, ***REMOVED***Caller caller);

    /** 查询 Wiki 页面详情，包含来源、要点与图谱节点数。 */
    WikiPageDetailView detail(String wikiId, ***REMOVED***Caller caller);

    /** 查询某个物料生成的 Wiki 页面列表。 */
    List<WikiPageView> listByMaterial(String materialId, ***REMOVED***Caller caller);

    /** 返回 Wiki 血缘（物料→Wiki→图谱节点），可按 wikiId 或 ***REMOVED***Id 范围查询。 */
    WikiLineageView lineage(String ***REMOVED***Id, String wikiId, ***REMOVED***Caller caller);
}
