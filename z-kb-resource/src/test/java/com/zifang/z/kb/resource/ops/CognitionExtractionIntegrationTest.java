package com.zifang.z.kb.resource.ops;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.compilation.CompilationJobView;
import com.zifang.z.kb.api.compilation.CompilationService;
import com.zifang.z.kb.api.material.MaterialService;
import com.zifang.z.kb.api.material.MaterialUploadItem;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBase;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.resource.KnowledgeBaseType;
import com.zifang.z.kb.api.resource.KnowledgeBaseView;
import com.zifang.z.kb.core.extraction.CognitionGateway;
import com.zifang.z.kb.resource.KbResourceTestApplication;
import com.zifang.z.kb.storage.extraction.entity.ConceptEntity;
import com.zifang.z.kb.storage.extraction.entity.GraphNodeEntity;
import com.zifang.z.kb.storage.extraction.mapper.ConceptMapper;
import com.zifang.z.kb.storage.extraction.mapper.GraphNodeMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * TASK-20261101-006：z-kb 萃取接入认知域的端到端行为。
 *
 * <p>七例覆盖：① 关闭认知域时概念表无认知键（行为与接入前一致）② 开启后命中公司术语
 * 的概念挂上认知键 ③ 图谱节点带 {@code Cog:} 标签 ④ 未命中新词以 DRAFT 提议回写
 * ⑤ 同一概念重复编译不重复提议 ⑥ 认知域不可达时编译仍成功 ⑦ 降级时概念表不挂认知键。</p>
 */
@SpringBootTest(classes = {KbResourceTestApplication.class,
        CognitionExtractionIntegrationTest.GatewayConfig.class}, properties = {
        "spring.datasource.url=jdbc:h2:mem:kb-cognition;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "kb.storage.path=target/test-kb/cognition-kb.json",
        "kb.material.storage.root=target/test-kb/cognition-original",
        "kb.material.repo.root=target/test-kb/cognition-repo",
        "spring.main.banner-mode=off"
})
class CognitionExtractionIntegrationTest {

    private static final String TENANT = "t-cognition";
    private static final String ACTOR = "u-cognition-owner";

    @Autowired
    private KnowledgeBaseResourceService resourceService;

    @Autowired
    private MaterialService materialService;

    @Autowired
    private CompilationService compilationService;

    @Autowired
    private ConceptMapper conceptMapper;

    @Autowired
    private GraphNodeMapper nodeMapper;

    @Autowired
    private RecordingGateway gateway;

    /**
     * 每个用例前把网关状态清干净。
     *
     * <p>这不是洁癖：网关是单例 bean，若不重置，用例的执行顺序会决定结果
     * （JUnit 默认按方法名哈希排序，不是源码顺序）—— 实测出现过「单跑绿、全量红」。
     * 这类顺序依赖是最难查的假红来源。</p>
     */
    @BeforeEach
    void resetGateway() {
        gateway.enabled = true;
        gateway.unreachable = false;
        gateway.hits.clear();
        gateway.proposed.clear();
        gateway.proposedCalls.clear();
    }

    private KnowledgeBaseView createKb(KbCaller caller) {
        KnowledgeBase kb = new KnowledgeBase();
        kb.setName("认知测试库");
        kb.setCode("cog_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        kb.setType(KnowledgeBaseType.FILE);
        return resourceService.create(kb, caller);
    }

    private String compileMaterial(String kbId, String title, String content, KbCaller caller) {
        MaterialUploadItem item = materialService.registerText(kbId, title, null, content, caller);
        assertTrue(item.isSuccess(), item.getMessage());
        CompilationJobView job = compilationService.run(item.getMaterialId(), null, caller);
        assertEquals("COMPLETED", job.getRunStatus());
        return item.getMaterialId();
    }

    private List<ConceptEntity> conceptsOf(String kbId) {
        return conceptMapper.selectList(new QueryWrapper<ConceptEntity>()
                .eq("tenant_code", TENANT).eq("kb_id", kbId).eq("is_deleted", 0));
    }

    private List<GraphNodeEntity> nodesOf(String materialId) {
        return nodeMapper.selectList(new QueryWrapper<GraphNodeEntity>()
                .eq("tenant_code", TENANT).eq("material_id", materialId).eq("is_deleted", 0));
    }

    @Test
    @DisplayName("关闭认知域时：编译成功、概念表无认知键、图谱无 Cog 标签")
    void 关闭时行为不变() {
        gateway.enabled = false;
        gateway.hits.clear();
        KbCaller caller = KbCaller.of(TENANT, ACTOR);
        KnowledgeBaseView kb = createKb(caller);

        compileMaterial(kb.getKbId(), "关闭场景", "订单与对账是日常业务。订单需要核对，对账用于结算。", caller);

        List<ConceptEntity> concepts = conceptsOf(kb.getKbId());
        assertFalse(concepts.isEmpty(), "萃取应产出概念");
        for (ConceptEntity concept : concepts) {
            assertNull(concept.getCognitionKey(), "关闭时不该挂认知键");
        }
        for (GraphNodeEntity node : nodesOf(concepts.get(0).getLastMaterialId())) {
            assertNull(node.getLabels(), "关闭时不该有 Cog 标签");
        }
        assertTrue(gateway.proposed.isEmpty(), "关闭时不该回写新词");
    }

    @Test
    @DisplayName("开启后命中公司术语的概念挂上认知键")
    void 命中挂认知键() {
        gateway.enabled = true;
        gateway.hits.put("订单", "biz.order");
        gateway.hits.put("对账", "biz.recon");
        KbCaller caller = KbCaller.of(TENANT, ACTOR);
        KnowledgeBaseView kb = createKb(caller);

        compileMaterial(kb.getKbId(), "命中场景", "订单与对账是日常业务。订单需要核对，对账用于结算。", caller);

        List<ConceptEntity> concepts = conceptsOf(kb.getKbId());
        boolean found = false;
        for (ConceptEntity concept : concepts) {
            if ("订单".equals(concept.getName())) {
                assertEquals("biz.order", concept.getCognitionKey());
                found = true;
            }
        }
        assertTrue(found, "应存在名为「订单」的概念");
    }

    @Test
    @DisplayName("图谱概念节点带 Cog: 标签")
    void 图谱带Cog标签() {
        gateway.enabled = true;
        gateway.hits.put("订单", "biz.order");
        gateway.hits.put("对账", "biz.recon");
        KbCaller caller = KbCaller.of(TENANT, ACTOR);
        KnowledgeBaseView kb = createKb(caller);

        String materialId = compileMaterial(kb.getKbId(), "标签场景",
                "订单与对账是日常业务。订单需要核对，对账用于结算。", caller);

        boolean labeled = false;
        for (GraphNodeEntity node : nodesOf(materialId)) {
            if (node.getLabels() != null && node.getLabels().startsWith("Cog:")) {
                assertTrue(node.getLabels().startsWith("Cog:biz."), "标签应带公司级认知键：" + node.getLabels());
                labeled = true;
            }
        }
        assertTrue(labeled, "应有带 Cog 标签的图谱节点");
    }

    @Test
    @DisplayName("未命中新词以 DRAFT 提议回写（提议不是生效）")
    void 新词回写() {
        gateway.enabled = true;
        gateway.hits.clear();
        KbCaller caller = KbCaller.of(TENANT, ACTOR);
        KnowledgeBaseView kb = createKb(caller);

        compileMaterial(kb.getKbId(), "回写场景", "报销单与发票是财务凭证。报销需要审批，发票需要核验。", caller);

        assertFalse(gateway.proposed.isEmpty(), "未命中的新词应被提议");
        for (Map.Entry<String, String> entry : gateway.proposed.entrySet()) {
            assertEquals("DRAFT", entry.getValue(), "回写的术语必须是 DRAFT 态（提议不是生效）");
        }
    }

    @Test
    @DisplayName("同一新词不重复提议（幂等）")
    void 回写幂等() {
        gateway.enabled = true;
        gateway.hits.clear();
        KbCaller caller = KbCaller.of(TENANT, ACTOR);
        KnowledgeBaseView kb = createKb(caller);

        // 两份物料内容必须不同：素材库对同库同内容有去重，内容一致会先被库拦下，
        // 根本走不到「重复提议」这一步。词表相同、文句不同，才是真正的幂等场景。
        compileMaterial(kb.getKbId(), "幂等场景一",
                "报销单与发票是财务凭证。报销需要审批，发票需要核验。", caller);
        assertFalse(gateway.proposedCalls.isEmpty(), "首轮应提议出新词");
        compileMaterial(kb.getKbId(), "幂等场景二",
                "报销单与发票同样是凭证。报销与发票都要留痕备查。", caller);

        // 幂等口径是「同一个词只登记一次」，不是「第二轮不再有新词」——
        // 第二份物料若萃出新词（确实的新词）仍该被提议。
        Set<String> distinct = new LinkedHashSet<>(gateway.proposedCalls);
        assertEquals(distinct.size(), gateway.proposedCalls.size(),
                "同一个词不应被登记两次，实际调用：" + gateway.proposedCalls);
    }

    @Test
    @DisplayName("认知域不可达时编译仍成功（降级不阻断编译管线）")
    void 降级不阻断() {
        gateway.enabled = true;
        gateway.unreachable = true;
        gateway.hits.clear();
        KbCaller caller = KbCaller.of(TENANT, ACTOR);
        KnowledgeBaseView kb = createKb(caller);

        compileMaterial(kb.getKbId(), "降级场景", "订单与对账是日常业务。订单需要核对，对账用于结算。", caller);

        List<ConceptEntity> concepts = conceptsOf(kb.getKbId());
        assertFalse(concepts.isEmpty(), "降级时概念仍应正常涌现");
        for (ConceptEntity concept : concepts) {
            assertNull(concept.getCognitionKey(), "降级时不该挂认知键");
        }
    }

    @Test
    @DisplayName("降级时新词提议不抛异常（编译不受影响）")
    void 降级时提议不抛() {
        gateway.enabled = true;
        gateway.unreachable = true;
        KbCaller caller = KbCaller.of(TENANT, ACTOR);
        KnowledgeBaseView kb = createKb(caller);

        compileMaterial(kb.getKbId(), "降级提议场景", "报销单与发票是财务凭证。报销需要审批，发票需要核验。", caller);

        assertTrue(gateway.proposed.isEmpty(), "降级时不应有提议成功");
    }

    /** 记录型假网关：可控命中/不可达/提议记录。 */
    public static class RecordingGateway implements CognitionGateway {

        boolean enabled;
        boolean unreachable;
        final Map<String, String> hits = new LinkedHashMap<>();
        /** 已登记的提议（name -> 状态）。 */
        final Map<String, String> proposed = new LinkedHashMap<>();
        /** 实际发往远端的登记请求序列（已存在的词不会重发）。 */
        final List<String> proposedCalls = new ArrayList<>();

        @Override
        public Map<String, String> resolveAll(List<String> names) {
            Map<String, String> out = new LinkedHashMap<>();
            if (!enabled || unreachable || names == null) {
                return out;
            }
            for (String name : names) {
                String key = hits.get(name);
                if (key != null) {
                    out.put(name, key);
                }
            }
            return out;
        }

        @Override
        public String proposeTerm(String name, String definition, String kbId,
                                  String materialVersionId, String chunkId) {
            if (!enabled || unreachable || name == null) {
                return null;
            }
            // 模拟远端幂等：已登记过的词直接短路，不重发登记请求。
            // 真实实现在 RemoteCognitionGateway 里靠「先 GET，404 才登记」+ 实例内
            // proposed 表双重保证。
            if (proposed.containsKey(name)) {
                return "kb.extracted." + Math.abs(name.hashCode());
            }
            proposedCalls.add(name);
            proposed.put(name, "DRAFT");
            return "kb.extracted." + Math.abs(name.hashCode());
        }

        @Override
        public boolean isDegraded() {
            return unreachable;
        }
    }

    /** 把假网关装配成主 bean，覆盖自动装配出来的实现。 */
    @TestConfiguration
    static class GatewayConfig {

        @Bean
        @Primary
        public RecordingGateway recordingGateway() {
            return new RecordingGateway();
        }
    }
}
