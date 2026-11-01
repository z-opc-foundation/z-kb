package com.zifang.z.kb.core.extraction;

import java.util.List;
import java.util.Map;

/**
 * 认知域网关（z-kb 侧的 SPI）：把「问公司级真源」这件事抽象出来。
 *
 * <p><b>为什么是本地 SPI 而不是直接引 z-cognition-client</b>：z-kb 是发 Maven Central 的仓，
 * 而 {@code z-cognition-client} 尚未发布到 Central —— 直接依赖会让 z-kb 的所有消费方
 * 在干净机器上解析不到这个坐标而构建失败。本地 SPI 把「协议细节」挡在实现侧：
 * core 层只说「我要消歧这批词」，实现侧（resource 模块，optional 依赖）才碰 client jar。</p>
 *
 * <p><b>零 Spring</b>：本接口不依赖任何容器类型，core 层可纯单测。</p>
 *
 * <p><b>降级语义</b>：实现必须在认知域不可达时返回空结果而不是抛异常 ——
 * 知识库编译管线不能被认知域拖垮。</p>
 */
public interface CognitionGateway {

    /**
     * 批量消歧。
     *
     * @param names 候选词（原始写法）
     * @return 命中表：词 → 公司级认知键；未命中/降级的词不在结果里（实现不得返回 null）
     */
    Map<String, String> resolveAll(List<String> names);

    /**
     * 以 DRAFT 态提议一个新术语进公司级真源。
     *
     * @param name              候选词
     * @param definition        本地释义
     * @param kbId              知识库标识
     * @param materialVersionId 物料版本标识
     * @param chunkId           检索块定位串
     * @return 登记成功返回术语键；未登记返回 null
     */
    String proposeTerm(String name, String definition, String kbId, String materialVersionId,
                       String chunkId);

    /** 是否处于降级状态（认知域不可达），供上层告警。 */
    boolean isDegraded();
}
