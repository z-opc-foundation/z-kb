package com.zifang.z.kb.ingest.api;

/**
 * 数据源类型 — 区分不同渠道。
 */
public enum DataSourceType {

    /** 语雀（yuque.com） */
    YUQUE("语雀"),

    /** Notion */
    NOTION("Notion"),

    /** Confluence / Jira Wiki */
    CONFLUENCE("Confluence"),

    /** 飞书（lark/feishu） */
    FEISHU("飞书"),

    /** 钉钉文档 */
    DINGTALK("钉钉文档"),

    /** Git 仓库（GitHub/GitLab/Gitee） */
    GIT("Git 仓库"),

    /** 本地目录 */
    LOCAL_DIR("本地目录"),

    /** 远程 URL（HTML 抓取） */
    URL("URL 抓取"),

    /** Webhook 接收 */
    WEBHOOK("Webhook"),

    /** 文件上传 */
    UPLOAD("文件上传"),

    /** 通用 Markdown 文本 */
    MARKDOWN("Markdown 文本");

    private final String label;

    DataSourceType(String label) { this.label = label; }

    public String getLabel() { return label; }
}