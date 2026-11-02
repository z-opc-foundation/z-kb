package com.zifang.z.kb.api.extraction;

import com.zifang.z.kb.api.resource.KbCaller;

/**
 * 本地规则萃取：编译 P4 阶段落库摘要/问句/术语/FAQ 与图谱，查询按物料返回产物。
 *
 * <p>规则完全确定，不调用 LLM；重复萃取同一物料版本会覆盖旧产物。</p>
 */
public interface ExtractionService {

    /** 按物料查询当前版本的萃取产物与计数，未编译时返回空产物与 NONE 里程碑。 */
    ExtractionMaterialView queryByMaterial(String materialId, KbCaller caller);

    /** 执行一次萃取并按物料版本覆盖落库，返回各类型条目与图谱计数。 */
    ExtractionCountView extract(ExtractionInput input, KbCaller caller);
}
