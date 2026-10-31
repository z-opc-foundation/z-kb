package com.zifang.z.kb.api.graph;

import com.zifang.z.kb.api.resource.KbCaller;

/**
 * 本地规则图谱查询：节点按名称、边按标识稳定排序，各上限 200 条。
 */
public interface GraphService {

    /** 按知识库查询图谱，可传 materialId 收窄证据资料。 */
    GraphView queryByKb(String kbId, String materialId, KbCaller caller);

    /** 按物料查询以其为证据资料的图谱节点与边。 */
    GraphView queryByMaterial(String materialId, KbCaller caller);
}
