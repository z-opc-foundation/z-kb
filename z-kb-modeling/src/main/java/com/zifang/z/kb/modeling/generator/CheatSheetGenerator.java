package com.zifang.z.kb.modeling.generator;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zifang.z.kb.modeling.model.CheatSheet;
import com.zifang.z.kb.modeling.model.ProductModel;

/**
 * 把 ProductModel 渲染成 Markdown 小抄。
 *
 * <p>结构：
 * <pre>
 *   # 📦 &lt;name&gt; 小抄
 *   &gt; 一句话：&lt;tagline&gt;
 *
 *   ## 🎯 目标用户
 *   - ...
 *
 *   ## ⚡ 解决什么问题
 *   - ...
 *
 *   ## 🛠️ 核心能力
 *   - ...
 *
 *   ## 🧱 架构层次
 *   - **&lt;layer&gt;**: &lt;desc&gt;
 *
 *   ## 🧰 技术栈
 *   - **&lt;category&gt;**: ...
 *
 *   ## 🔄 数据流
 *   A → B → C
 *
 *   ## 🧠 因果链条（怎么工作的）
 *   1. 触发 A → 产生 B → 影响 C
 *
 *   ## 📈 关键指标
 *   - &lt;key&gt;: &lt;value&gt;
 * </pre>
 */
public class CheatSheetGenerator {

    private final ObjectMapper mapper = new ObjectMapper();

    public CheatSheet generate(ProductModel model) {
        CheatSheet cs = new CheatSheet();
        cs.setProductName(model.getProductName());
        cs.setTagline(model.getTagline());

        StringBuilder sb = new StringBuilder();
        appendHeader(sb, model);
        appendSection(sb, "🎯 目标用户", renderList(model.getTargetUsers()));
        appendSection(sb, "⚡ 解决什么问题", renderList(model.getCoreProblems()));
        appendSection(sb, "🛠️ 核心能力", renderList(model.getCapabilities(), 15));
        appendSection(sb, "🧱 架构层次", renderNamedItems(model.getArchitectureLayers()));
        appendSection(sb, "🧰 技术栈", renderTechStack(model.getTechStack()));
        appendSection(sb, "🔄 数据流", renderDataFlow(model.getDataFlow()));
        appendSection(sb, "🧠 因果链条（产品怎么工作的）", renderCausalChain(model.getCausalChain()));
        appendSection(sb, "📈 关键指标", renderNamedItems(model.getSuccessMetrics()));
        appendFooter(sb, model);

        cs.setMarkdown(sb.toString());
        try {
            cs.setProductModelJson(mapper.writeValueAsString(model));
        } catch (Exception e) {
            cs.setProductModelJson("{}");
        }
        return cs;
    }

    private void appendHeader(StringBuilder sb, ProductModel model) {
        sb.append("# 📦 ").append(nullSafe(model.getProductName(), "未命名产品")).append(" 产品小抄\n\n");
        sb.append("> 一句话：").append(nullSafe(model.getTagline(), "（未提供）")).append("\n\n");
        sb.append("---\n\n");
    }

    private void appendSection(StringBuilder sb, String title, String content) {
        if (content == null || content.isEmpty()) return;
        sb.append("## ").append(title).append("\n\n");
        sb.append(content).append("\n\n");
        sb.append("---\n\n");
    }

    private String renderList(java.util.List<String> items) {
        if (items == null || items.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        for (String s : items) {
            if (s == null || s.isEmpty()) continue;
            sb.append("- ").append(s).append("\n");
        }
        return sb.toString();
    }

    private String renderList(java.util.List<String> items, int limit) {
        if (items == null) return "";
        java.util.List<String> top = items.size() > limit ? items.subList(0, limit) : items;
        return renderList(top);
    }

    private String renderNamedItems(java.util.Map<String, String> map) {
        if (map == null || map.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        for (var e : map.entrySet()) {
            sb.append("- **").append(e.getKey()).append("**");
            if (e.getValue() != null && !e.getValue().isEmpty()) {
                sb.append(": ").append(e.getValue());
            }
            sb.append("\n");
        }
        return sb.toString();
    }

    private String renderTechStack(java.util.Map<String, java.util.List<String>> techStack) {
        if (techStack == null || techStack.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        for (var e : techStack.entrySet()) {
            sb.append("- **").append(e.getKey()).append("**: ");
            if (e.getValue() != null) sb.append(String.join("、", e.getValue()));
            sb.append("\n");
        }
        return sb.toString();
    }

    private String renderDataFlow(java.util.List<ProductModel.DataFlowStep> steps) {
        if (steps == null || steps.isEmpty()) {
            return "（未检测到明确的数据流描述）";
        }
        StringBuilder sb = new StringBuilder();
        // Mermaid 图
        sb.append("```mermaid\n");
        sb.append("flowchart LR\n");
        int i = 0;
        for (ProductModel.DataFlowStep step : steps) {
            String from = sanitizeNode(step.getFrom());
            String to = sanitizeNode(step.getTo());
            sb.append("  ").append(from).append(" --> ").append(to);
            if (step.getDescription() != null && !step.getDescription().isEmpty()) {
                sb.append(" : ").append(sanitizeEdge(step.getDescription()));
            }
            sb.append("\n");
            i++;
            if (i > 30) break;
        }
        sb.append("```\n\n");
        sb.append("**步骤清单**：\n");
        i = 1;
        for (ProductModel.DataFlowStep step : steps) {
            sb.append(i++).append(". ").append(step.getFrom()).append(" → ").append(step.getTo());
            if (step.getDescription() != null && !step.getDescription().isEmpty()) {
                sb.append("（").append(step.getDescription()).append("）");
            }
            sb.append("\n");
            if (i > 30) break;
        }
        return sb.toString();
    }

    private String renderCausalChain(java.util.List<ProductModel.CausalLink> links) {
        if (links == null || links.isEmpty()) {
            return "（未检测到明确的因果表达）";
        }
        StringBuilder sb = new StringBuilder();
        // Mermaid
        sb.append("```mermaid\n");
        sb.append("flowchart LR\n");
        int n = 0;
        java.util.Set<String> nodes = new java.util.LinkedHashSet<>();
        java.util.Map<String, String> idMap = new java.util.HashMap<>();
        for (ProductModel.CausalLink link : links) {
            String cId = nodeId("c_" + Math.abs(link.getCause().hashCode() % 99999));
            String eId = nodeId("e_" + Math.abs(link.getEffect().hashCode() % 99999));
            idMap.put(link.getCause(), cId);
            idMap.put(link.getEffect(), eId);
        }
        for (ProductModel.CausalLink link : links) {
            String cId = idMap.get(link.getCause());
            String eId = idMap.get(link.getEffect());
            sb.append("  ").append(cId).append("[\"").append(safeLabel(link.getCause()))
                    .append("\"] -->|").append(link.getRelation().toLowerCase()).append("| ")
                    .append(eId).append("[\"").append(safeLabel(link.getEffect())).append("\"]\n");
            n++;
            if (n > 20) break;
        }
        sb.append("```\n\n");
        // 文字版
        sb.append("**逻辑推导**：\n");
        n = 1;
        for (ProductModel.CausalLink link : links) {
            sb.append(n++).append(". ").append(link.getCause())
                    .append(" → *").append(relationZh(link.getRelation())).append("* → ")
                    .append(link.getEffect()).append("\n");
            if (n > 20) break;
        }
        sb.append("\n💡 这是从源文档里抽取出来的关键因果关系，按置信度排序。");
        return sb.toString();
    }

    private String relationZh(String r) {
        if (r == null) return "导致";
        switch (r) {
            case "CAUSES":   return "导致";
            case "ENABLES":  return "使得";
            case "REQUIRES": return "需要";
            case "PRODUCES": return "产出";
            case "TRIGGERS": return "触发";
            default:         return r;
        }
    }

    private void appendFooter(StringBuilder sb, ProductModel model) {
        sb.append("---\n\n");
        sb.append("📅 生成时间：").append(model.getGeneratedAt()).append("\n");
        if (model.getSourceDocumentIds() != null && !model.getSourceDocumentIds().isEmpty()) {
            sb.append("📚 源文档数：").append(model.getSourceDocumentIds().size()).append("\n");
        }
        sb.append("🧬 by z-kb modeling\n");
    }

    private String sanitizeNode(String s) {
        if (s == null) return "unknown";
        s = s.replaceAll("[^\\u4e00-\\u9fa5a-zA-Z0-9]", "_");
        if (s.isEmpty()) return "node";
        return s.length() > 30 ? s.substring(0, 30) : s;
    }

    private String sanitizeEdge(String s) {
        if (s == null) return "";
        return s.replaceAll("[\\r\\n]", " ").replaceAll("[\"`]", "'");
    }

    private String safeLabel(String s) {
        if (s == null) return "";
        String t = s.replaceAll("[\"`]", "'").replaceAll("[\\r\\n]", " ");
        return t.length() > 40 ? t.substring(0, 40) + "..." : t;
    }

    private String nodeId(String prefix) {
        return prefix.replaceAll("[^a-zA-Z0-9_]", "_");
    }

    private String nullSafe(String s, String d) {
        return (s == null || s.isEmpty()) ? d : s;
    }
}