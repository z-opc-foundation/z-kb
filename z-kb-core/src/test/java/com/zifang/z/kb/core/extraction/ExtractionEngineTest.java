package com.zifang.z.kb.core.extraction;

import com.zifang.z.kb.api.extraction.ExtractionChunk;
import com.zifang.z.kb.api.extraction.ExtractionInput;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 本地确定性规则引擎与概念命名口径的单元测试。
 */
class ExtractionEngineTest {

    private final ExtractionEngine engine = new ExtractionEngine();

    @Test
    @DisplayName("两条章节：摘要/问句/术语/FAQ 与图谱按规则生成且数量受上限约束")
    void extractStructuredItems() {
        ExtractionResult result = engine.extract(sampleInput());

        assertEquals(1, count(result, ExtractionEngine.TYPE_SUMMARY));
        assertEquals(4, count(result, ExtractionEngine.TYPE_QUESTION));
        assertEquals(5, count(result, ExtractionEngine.TYPE_TERM));
        assertEquals(2, count(result, ExtractionEngine.TYPE_FAQ));
        assertEquals(12, result.getItems().size());

        ExtractionItemDraft summary = first(result, ExtractionEngine.TYPE_SUMMARY);
        assertEquals("知识库设计", summary.getTitle());
        assertEquals(1, summary.getSeq());
        assertTrue(summary.getContent().contains("向量索引"));
        assertTrue(summary.getEvidenceJson().startsWith("{\"chunk\":0,\"start\":0"));

        ExtractionItemDraft question = first(result, ExtractionEngine.TYPE_QUESTION);
        assertEquals("检索增强是什么？", question.getTitle());

        List<String> termNames = new ArrayList<>();
        for (ExtractionItemDraft item : result.getItems()) {
            if (ExtractionEngine.TYPE_TERM.equals(item.getItemType())) {
                termNames.add(item.getTitle());
            }
        }
        assertTrue(termNames.contains("检索增强"));
        assertTrue(termNames.contains("图谱结构"));
        assertTrue(termNames.contains("向量索引"));

        ExtractionItemDraft faq = first(result, ExtractionEngine.TYPE_FAQ);
        assertEquals("检索增强是什么？", faq.getTitle());
        assertTrue(faq.getContent().startsWith("检索增强依赖向量索引。"));
    }

    @Test
    @DisplayName("图谱：物料节点 + 概念节点 + MENTIONS/RELATED_TO 边，标识确定性生成")
    void extractGraphIsDeterministic() {
        ExtractionInput input = sampleInput();
        ExtractionResult first = engine.extract(input);
        ExtractionResult second = engine.extract(input);

        assertEquals(6, first.getNodes().size());
        assertEquals(9, first.getEdges().size());
        assertEquals(5, first.getConcepts().size());
        assertEquals(nodeIds(first), nodeIds(second));
        assertEquals(edgeIds(first), edgeIds(second));

        ExtractionNodeDraft material = first.getNodes().get(0);
        assertEquals("material:" + input.getMaterialId(), material.getNodeId());
        assertEquals(ExtractionEngine.NODE_MATERIAL, material.getNodeType());
        assertTrue(material.getEvidenceJson().contains("\"materialVersionId\":\"ver-1\""));
        assertTrue(material.getEvidenceJson().contains("\"draftId\":\"draft-1\""));

        int mentions = 0;
        int related = 0;
        for (ExtractionEdgeDraft edge : first.getEdges()) {
            if (ExtractionEngine.EDGE_MENTIONS.equals(edge.getEdgeType())) {
                mentions++;
                assertEquals("material:" + input.getMaterialId(), edge.getSourceNodeId());
            } else if (ExtractionEngine.EDGE_RELATED_TO.equals(edge.getEdgeType())) {
                related++;
                assertTrue(edge.getSourceNodeId().startsWith("concept:"));
                assertTrue(edge.getTargetNodeId().startsWith("concept:"));
                assertTrue(edge.getSourceNodeId().compareTo(edge.getTargetNodeId()) < 0);
            }
            assertEquals(ExtractionEngine.edgeId(edge.getSourceNodeId(), edge.getTargetNodeId(),
                    edge.getEdgeType()), edge.getEdgeId());
        }
        assertEquals(5, mentions);
        assertEquals(4, related);
    }

    @Test
    @DisplayName("多处章节时问句、FAQ 与术语都截断到各自上限")
    void extractRespectsCaps() {
        ExtractionInput input = new ExtractionInput();
        input.setKbId("kb-1");
        input.setMaterialId("mat-1");
        input.setMaterialVersionId("ver-1");
        input.setMaterialTitle("上限检验");
        List<ExtractionChunk> chunks = new ArrayList<>();
        String[] headings = {"架构概览", "数据模型", "接口契约", "权限模型", "部署拓扑", "运维监控",
                "故障处理", "演进路线"};
        for (int i = 0; i < headings.length; i++) {
            chunks.add(new ExtractionChunk(i + 1, headings[i],
                    headings[i] + "章节正文，说明" + headings[i] + "的组成与约束。"));
        }
        input.setChunks(chunks);

        ExtractionResult result = engine.extract(input);

        assertEquals(5, count(result, ExtractionEngine.TYPE_QUESTION));
        assertEquals(5, count(result, ExtractionEngine.TYPE_FAQ));
        assertEquals(5, count(result, ExtractionEngine.TYPE_TERM));
    }

    @Test
    @DisplayName("空输入：null 直接返回空结果；无正文时不产生摘要与 FAQ")
    void extractEmptyInput() {
        ExtractionResult nullInput = engine.extract(null);
        assertTrue(nullInput.getItems().isEmpty());
        assertTrue(nullInput.getNodes().isEmpty());
        assertTrue(nullInput.getEdges().isEmpty());
        assertTrue(nullInput.getConcepts().isEmpty());

        ExtractionResult blank = engine.extract(new ExtractionInput());
        assertEquals(0, count(blank, ExtractionEngine.TYPE_SUMMARY));
        assertEquals(0, count(blank, ExtractionEngine.TYPE_FAQ));
    }

    @Test
    @DisplayName("概念命名：归一化去空白转小写，ID 前缀 cpt_ 且稳定")
    void conceptNames() {
        assertEquals("向量索引", ConceptNames.normalize("  向量 索引 "));
        assertEquals("vectorindex", ConceptNames.normalize("Vector\tIndex"));
        assertEquals("", ConceptNames.normalize(null));

        String id = ConceptNames.conceptIdOf("t1", "kb1", "向量索引");
        assertTrue(id.startsWith("cpt_"));
        assertEquals(28, id.length());
        assertEquals(id, ConceptNames.conceptIdOf("t1", "kb1", "向量索引"));
        assertFalse(id.equals(ConceptNames.conceptIdOf("t1", "kb2", "向量索引")));
    }

    @Test
    @DisplayName("图谱空间键与边标识：spaceKey 为 kb:{kbId}，边标识由源/目标/类型哈希")
    void identifiers() {
        assertEquals("kb:kb-1", ExtractionEngine.graphSpaceKey("kb-1"));
        String edge = ExtractionEngine.edgeId("material:m1", "concept:c1",
                ExtractionEngine.EDGE_MENTIONS);
        assertTrue(edge.startsWith("edge:"));
        assertEquals(29, edge.length());
        assertEquals(edge, ExtractionEngine.edgeId("material:m1", "concept:c1",
                ExtractionEngine.EDGE_MENTIONS));
        assertFalse(edge.equals(ExtractionEngine.edgeId("material:m1", "concept:c2",
                ExtractionEngine.EDGE_MENTIONS)));
    }

    private ExtractionInput sampleInput() {
        ExtractionInput input = new ExtractionInput();
        input.setKbId("kb-1");
        input.setMaterialId("mat-1");
        input.setMaterialVersionId("ver-1");
        input.setMaterialTitle("知识库设计.md");
        input.setDraftId("draft-1");
        List<ExtractionChunk> chunks = new ArrayList<>();
        chunks.add(new ExtractionChunk(1, "检索增强",
                "检索增强依赖向量索引。向量索引可以加速知识检索。知识库需要图谱。"));
        chunks.add(new ExtractionChunk(2, "图谱结构",
                "图谱结构由节点与边组成。节点包含物料与概念。"));
        input.setChunks(chunks);
        return input;
    }

    private static int count(ExtractionResult result, String type) {
        int total = 0;
        for (ExtractionItemDraft item : result.getItems()) {
            if (type.equals(item.getItemType())) {
                total++;
            }
        }
        return total;
    }

    private static ExtractionItemDraft first(ExtractionResult result, String type) {
        for (ExtractionItemDraft item : result.getItems()) {
            if (type.equals(item.getItemType())) {
                return item;
            }
        }
        throw new AssertionError("缺少类型 " + type);
    }

    private static List<String> nodeIds(ExtractionResult result) {
        List<String> ids = new ArrayList<>();
        for (ExtractionNodeDraft node : result.getNodes()) {
            ids.add(node.getNodeId());
        }
        return ids;
    }

    private static List<String> edgeIds(ExtractionResult result) {
        List<String> ids = new ArrayList<>();
        for (ExtractionEdgeDraft edge : result.getEdges()) {
            ids.add(edge.getEdgeId());
        }
        return ids;
    }
}
