package com.zifang.z.kb.modeling.extractor;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.Document;
import com.zifang.z.kb.api.Entity;
import com.zifang.z.kb.api.Relation;
import com.zifang.z.kb.modeling.model.ProductModel;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 产品拆解器 — 把一组文档拆成 ProductModel 的各字段：
 * <ul>
 *   <li>productName / tagline — 从标题与首段抽取</li>
 *   <li>targetUsers — 用户相关章节（"## 用户"、"目标用户"等）</li>
 *   <li>coreProblems — 问题相关章节（"痛点"、"问题"、"场景"）</li>
 *   <li>capabilities — 功能相关章节（"功能"、"特性"、"能力"）</li>
 *   <li>architectureLayers — 架构相关章节（"架构"、"模块"、"组件"）</li>
 *   <li>techStack — 技术栈相关章节（"技术栈"、"依赖"、"技术"）</li>
 *   <li>dataFlow — 流程相关章节（"流程"、"数据流"）</li>
 *   <li>successMetrics — 指标相关章节（"指标"、"KPI"）</li>
 * </ul>
 */
public class ProductDecomposer {

    private static final Pattern HEADING = Pattern.compile("^(#{1,6})\\s+(.+)$", Pattern.MULTILINE);

    private static final Map<String, String[]> SECTION_HINTS = new LinkedHashMap<>();
    static {
        SECTION_HINTS.put("targetUsers",       new String[]{"目标用户", "用户画像", "用户群体", "适用人群", "Target Users", "Audience", "Users"});
        SECTION_HINTS.put("coreProblems",      new String[]{"痛点", "问题", "场景", "挑战", "挑战", "需求", "Pain Point", "Problem", "Scenario"});
        SECTION_HINTS.put("capabilities",      new String[]{"功能", "特性", "能力", "特性", "Feature", "Capability"});
        SECTION_HINTS.put("architectureLayers",new String[]{"架构", "模块", "组件", "层次", "子系统", "Architecture", "Modules"});
        SECTION_HINTS.put("techStack",         new String[]{"技术栈", "依赖", "技术", "选型", "Tech Stack", "Stack", "Dependencies"});
        SECTION_HINTS.put("dataFlow",          new String[]{"流程", "数据流", "时序", "工作流", "Workflow", "Data Flow", "Pipeline"});
        SECTION_HINTS.put("successMetrics",    new String[]{"指标", "KPI", "目标", "评估", "Metric", "Goals"});
    }

    public ProductModel decompose(List<Document> documents, List<Chunk> chunks,
                                   List<Entity> entities, List<Relation> relations) {
        ProductModel model = new ProductModel();

        if (documents == null || documents.isEmpty()) {
            model.setProductName("未知产品");
            model.setTagline("未提供文档");
            return model;
        }

        // 1) 标题与 tagline
        Document first = documents.get(0);
        model.setProductName(first.getTitle() != null ? first.getTitle() : "未命名产品");
        String tagline = inferTagline(first.getBody() != null ? first.getBody() : first.getContent());
        if (tagline != null) model.setTagline(tagline);

        // 2) 按章节分类抽取
        Map<String, List<String>> sections = splitSections(documents);

        for (var e : SECTION_HINTS.entrySet()) {
            String field = e.getKey();
            List<String> hits = matchSections(sections, e.getValue());
            switch (field) {
                case "targetUsers":
                    model.setTargetUsers(extractListItems(hits).stream().distinct().collect(Collectors.toList()));
                    break;
                case "coreProblems":
                    model.setCoreProblems(extractListItems(hits).stream().distinct().collect(Collectors.toList()));
                    break;
                case "capabilities":
                    model.setCapabilities(extractListItems(hits).stream().distinct().limit(20).collect(Collectors.toList()));
                    break;
                case "architectureLayers":
                    Map<String, String> arch = extractNamedItems(hits);
                    model.setArchitectureLayers(arch);
                    break;
                case "techStack":
                    model.setTechStack(groupTech(hits));
                    break;
                case "dataFlow":
                    model.setDataFlow(parseDataFlow(hits));
                    break;
                case "successMetrics":
                    model.setSuccessMetrics(extractNamedItems(hits));
                    break;
            }
        }

        // 3) 用实体补充架构 / 技术栈
        if (entities != null) {
            for (Entity e : entities) {
                if (e.getType() == null) continue;
                String type = e.getType().name();
                String name = e.getCanonicalName() != null ? e.getCanonicalName() : e.getDisplayName();
                if (name == null) continue;
                model.getTechStack().computeIfAbsent(type, k -> new ArrayList<>());
                if (!model.getTechStack().get(type).contains(name)) {
                    model.getTechStack().get(type).add(name);
                }
            }
        }

        // 4) 来源
        for (Document d : documents) {
            if (!model.getSourceDocumentIds().contains(d.getId())) {
                model.getSourceDocumentIds().add(d.getId());
            }
        }

        return model;
    }

    /** 把每篇文档切成 (heading, content) 段 */
    private Map<String, List<String>> splitSections(List<Document> docs) {
        Map<String, List<String>> map = new HashMap<>();
        for (Document d : docs) {
            String body = d.getBody() != null ? d.getBody() : d.getContent();
            if (body == null) continue;
            Matcher m = HEADING.matcher(body);
            int idx = 0;
            String current = "_preamble";
            StringBuilder currentContent = new StringBuilder();
            while (m.find()) {
                String section = m.group(2).trim();
                map.computeIfAbsent(current, k -> new ArrayList<>()).add(currentContent.toString().trim());
                current = section;
                currentContent = new StringBuilder();
                idx = m.end();
            }
            map.computeIfAbsent(current, k -> new ArrayList<>()).add(currentContent.toString().trim());
        }
        return map;
    }

    private List<String> matchSections(Map<String, List<String>> sections, String[] hints) {
        List<String> out = new ArrayList<>();
        for (var entry : sections.entrySet()) {
            String heading = entry.getKey().toLowerCase();
            boolean match = false;
            for (String hint : hints) {
                if (heading.contains(hint.toLowerCase())) { match = true; break; }
            }
            if (match) out.addAll(entry.getValue());
        }
        return out;
    }

    private List<String> extractListItems(List<String> sections) {
        List<String> out = new ArrayList<>();
        for (String s : sections) {
            for (String line : s.split("\n")) {
                String t = line.trim();
                if (t.matches("^[-*+]\\s+.+") || t.matches("^\\d+\\.\\s+.+")) {
                    out.add(t.replaceFirst("^[-*+\\d.\\s]+", "").trim());
                }
            }
        }
        return out;
    }

    private Map<String, String> extractNamedItems(List<String> sections) {
        Map<String, String> out = new LinkedHashMap<>();
        for (String s : sections) {
            for (String line : s.split("\n")) {
                String t = line.trim();
                if (t.matches("^[-*+]\\s+.{2,40}[:：].*")) {
                    String[] kv = t.replaceFirst("^[-*+]", "").trim().split("[:：]", 2);
                    if (kv.length == 2) out.put(kv[0].trim(), kv[1].trim());
                } else if (t.matches("^[-*+]\\s+.+")) {
                    out.put(t.replaceFirst("^[-*+]", "").trim(), "");
                }
            }
        }
        return out;
    }

    private Map<String, List<String>> groupTech(List<String> sections) {
        Map<String, List<String>> out = new LinkedHashMap<>();
        for (String s : sections) {
            for (String line : s.split("\n")) {
                String t = line.trim();
                if (t.matches("^[-*+]\\s+.{2,40}[:：].*")) {
                    String[] kv = t.replaceFirst("^[-*+]", "").trim().split("[:：]", 2);
                    if (kv.length == 2) {
                        out.computeIfAbsent(kv[0].trim(), k -> new ArrayList<>())
                                .add(kv[1].trim());
                    }
                }
            }
        }
        return out;
    }

    private List<ProductModel.DataFlowStep> parseDataFlow(List<String> sections) {
        List<ProductModel.DataFlowStep> out = new ArrayList<>();
        for (String s : sections) {
            for (String line : s.split("\n")) {
                String t = line.trim();
                // 形如 "A -> B: desc" 或 "A → B"
                if (t.matches("^.{1,40}\\s*(→|->|=>)\\s*.+")) {
                    String[] parts = t.split("\\s*(→|->|=>)\\s*", 2);
                    if (parts.length == 2) {
                        out.add(new ProductModel.DataFlowStep(parts[0].trim(), parts[1].trim(), ""));
                    }
                } else if (t.matches("^\\d+\\.\\s+.+\\s*(→|->|=>)\\s*.+")) {
                    String[] parts = t.replaceFirst("^\\d+\\.\\s+", "").split("\\s*(→|->|=>)\\s*", 2);
                    if (parts.length == 2) {
                        out.add(new ProductModel.DataFlowStep(parts[0].trim(), parts[1].trim(), ""));
                    }
                }
            }
        }
        return out;
    }

    private String inferTagline(String body) {
        if (body == null) return null;
        String[] lines = body.split("\n");
        for (String line : lines) {
            String t = line.trim();
            if (t.isEmpty() || t.startsWith("#")) continue;
            if (t.length() > 20 && t.length() < 200) {
                return t.replaceAll("[#*_>`]", "").trim();
            }
        }
        return null;
    }
}