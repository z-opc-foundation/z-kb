package com.zifang.z.kb.modeling.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 产品模型 — 一份"产品小抄"，是 z-kb 的核心增值产物。
 *
 * <p>把一个产品的设计文档拆成可学习的逻辑因果链条，让开发者/产品能快速理解：
 * <ul>
 *   <li>它是给谁用的（用户画像）</li>
 *   <li>它解决什么问题（核心问题）</li>
 *   <li>它是怎么运作的（数据流 / 因果链条）</li>
 *   <li>它由什么组件构成（架构）</li>
 *   <li>它用了什么技术栈（依赖）</li>
 *   <li>它的关键指标（成功要素）</li>
 * </ul>
 *
 * <p>最终可以渲染成 Markdown 卡片（Cheat Sheet）、Mermaid 流程图、依赖关系表等多种形式。
 */
public class ProductModel {

    /** 产品/项目名称 */
    private String productName;

    /** 一句话描述 */
    private String tagline;

    /** 目标用户 */
    private List<String> targetUsers = new ArrayList<>();

    /** 核心问题 */
    private List<String> coreProblems = new ArrayList<>();

    /** 核心能力（产品功能） */
    private List<String> capabilities = new ArrayList<>();

    /** 架构层级：模块名 → 描述 */
    private Map<String, String> architectureLayers = new LinkedHashMap<>();

    /** 技术栈：类别 → 列表 */
    private Map<String, List<String>> techStack = new LinkedHashMap<>();

    /** 数据流步骤：from → to → desc */
    private List<DataFlowStep> dataFlow = new ArrayList<>();

    /** 因果链条 — 产品怎么工作的核心 */
    private List<CausalLink> causalChain = new ArrayList<>();

    /** 关键指标 */
    private Map<String, String> successMetrics = new LinkedHashMap<>();

    /** 来源文档 ID */
    private List<String> sourceDocumentIds = new ArrayList<>();

    /** 生成时间 */
    private Instant generatedAt = Instant.now();

    /** 额外元数据 */
    private Map<String, Object> metadata = new LinkedHashMap<>();

    public static class DataFlowStep {
        private String from;
        private String to;
        private String description;

        public DataFlowStep() {}
        public DataFlowStep(String from, String to, String description) {
            this.from = from; this.to = to; this.description = description;
        }
        public String getFrom() { return from; }
        public void setFrom(String from) { this.from = from; }
        public String getTo() { return to; }
        public void setTo(String to) { this.to = to; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }

    public static class CausalLink {
        /** 因（输入 / 触发） */
        private String cause;
        /** 果（输出 / 结果） */
        private String effect;
        /** 关系类型：CAUSES / ENABLES / REQUIRES / PRODUCES / TRIGGERS */
        private String relation = "CAUSES";
        /** 置信度 0-1 */
        private double confidence = 0.5;
        /** 支撑证据（句子片段） */
        private String evidence;

        public CausalLink() {}
        public CausalLink(String cause, String effect) { this.cause = cause; this.effect = effect; }
        public CausalLink(String cause, String effect, String evidence) {
            this.cause = cause; this.effect = effect; this.evidence = evidence;
        }
        public String getCause() { return cause; }
        public void setCause(String cause) { this.cause = cause; }
        public String getEffect() { return effect; }
        public void setEffect(String effect) { this.effect = effect; }
        public String getRelation() { return relation; }
        public void setRelation(String relation) { this.relation = relation; }
        public double getConfidence() { return confidence; }
        public void setConfidence(double confidence) { this.confidence = confidence; }
        public String getEvidence() { return evidence; }
        public void setEvidence(String evidence) { this.evidence = evidence; }
    }

    // getters/setters
    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }
    public String getTagline() { return tagline; }
    public void setTagline(String tagline) { this.tagline = tagline; }
    public List<String> getTargetUsers() { return targetUsers; }
    public void setTargetUsers(List<String> targetUsers) { this.targetUsers = targetUsers; }
    public List<String> getCoreProblems() { return coreProblems; }
    public void setCoreProblems(List<String> coreProblems) { this.coreProblems = coreProblems; }
    public List<String> getCapabilities() { return capabilities; }
    public void setCapabilities(List<String> capabilities) { this.capabilities = capabilities; }
    public Map<String, String> getArchitectureLayers() { return architectureLayers; }
    public void setArchitectureLayers(Map<String, String> architectureLayers) { this.architectureLayers = architectureLayers; }
    public Map<String, List<String>> getTechStack() { return techStack; }
    public void setTechStack(Map<String, List<String>> techStack) { this.techStack = techStack; }
    public List<DataFlowStep> getDataFlow() { return dataFlow; }
    public void setDataFlow(List<DataFlowStep> dataFlow) { this.dataFlow = dataFlow; }
    public List<CausalLink> getCausalChain() { return causalChain; }
    public void setCausalChain(List<CausalLink> causalChain) { this.causalChain = causalChain; }
    public Map<String, String> getSuccessMetrics() { return successMetrics; }
    public void setSuccessMetrics(Map<String, String> successMetrics) { this.successMetrics = successMetrics; }
    public List<String> getSourceDocumentIds() { return sourceDocumentIds; }
    public void setSourceDocumentIds(List<String> sourceDocumentIds) { this.sourceDocumentIds = sourceDocumentIds; }
    public Instant getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(Instant generatedAt) { this.generatedAt = generatedAt; }
    public Map<String, Object> getMetadata() { return metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata; }
}