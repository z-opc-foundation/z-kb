package com.zifang.z.kb.modeling.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 产品小抄 — 由 ProductModel 渲染出来的 Markdown 速查文档。
 *
 * <p>典型输出形式：
 * <pre>
 *   # 📦 InfluxDB 产品小抄
 *   > 一句话：主流开源时序数据库
 *   ...
 *   ## 🎯 用户
 *   - ...
 *   ## ⚙️ 工作原理（因果链）
 *   1. 客户端写入 → ...
 *   ...
 * </pre>
 */
public class CheatSheet {

    /** 产品名称 */
    private String productName;

    /** 一句话定位 */
    private String tagline;

    /** Markdown 内容 */
    private String markdown;

    /** 章节标题（用于侧边目录） */
    private List<String> sectionTitles = new ArrayList<>();

    /** 关键概念 ID（用于交互卡片） */
    private List<String> conceptIds = new ArrayList<>();

    /** 生成时间 */
    private Instant generatedAt = Instant.now();

    /** 关联的产品模型 JSON（可选） */
    private String productModelJson;

    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }
    public String getTagline() { return tagline; }
    public void setTagline(String tagline) { this.tagline = tagline; }
    public String getMarkdown() { return markdown; }
    public void setMarkdown(String markdown) { this.markdown = markdown; }
    public List<String> getSectionTitles() { return sectionTitles; }
    public void setSectionTitles(List<String> sectionTitles) { this.sectionTitles = sectionTitles; }
    public List<String> getConceptIds() { return conceptIds; }
    public void setConceptIds(List<String> conceptIds) { this.conceptIds = conceptIds; }
    public Instant getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(Instant generatedAt) { this.generatedAt = generatedAt; }
    public String getProductModelJson() { return productModelJson; }
    public void setProductModelJson(String productModelJson) { this.productModelJson = productModelJson; }
}