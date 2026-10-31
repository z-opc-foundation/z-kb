package com.zifang.z.kb.api.wiki;

import com.zifang.z.kb.api.resource.KbCaller;

import java.util.List;

/**
 * Wiki 产物：由已解析资料确定性生成页面，并维护来源与血缘。
 *
 * <p>z-kb 没有独立任务内核，{@link #compile} 在请求内同步完成生成并返回终态；
 * 页面、来源与目录均落库，接口形状对齐参考实现。</p>
 */
public interface WikiService {

    /** 为一批物料生成或更新 Wiki 页面，返回每条的成功/失败明细。 */
    WikiGenerateResultView generate(String kbId, List<String> materialIds, KbCaller caller);

    /** 落库一次 Agent 编译产物：按页面标识幂等写入多页，并刷新文档目录与块覆盖。 */
    WikiGeneratedDocView saveGenerated(WikiAgentSaveParam param, KbCaller caller);

    /** 提交一次 Wiki 编译：同步生成规则页面并返回任务句柄。 */
    WikiCompileTaskView compile(WikiCompileParam param, KbCaller caller);

    /** 查询某个物料最近一次 Agent 编译产物，不存在返回 null。 */
    WikiGeneratedDocView queryGenerated(String materialId, KbCaller caller);

    /** 列出知识库下的 Wiki 页面，支持关键词过滤与条数限制。 */
    List<WikiPageView> list(String kbId, String keyword, int limit, KbCaller caller);

    /** 查询 Wiki 页面详情，包含来源、要点与图谱节点数。 */
    WikiPageDetailView detail(String wikiId, KbCaller caller);

    /** 查询某个物料生成的 Wiki 页面列表。 */
    List<WikiPageView> listByMaterial(String materialId, KbCaller caller);

    /** 返回 Wiki 血缘（物料→Wiki→图谱节点），可按 wikiId 或 kbId 范围查询。 */
    WikiLineageView lineage(String kbId, String wikiId, KbCaller caller);
}
