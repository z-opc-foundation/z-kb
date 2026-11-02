package com.zifang.z.kb.ingest.api;

import java.util.List;
import java.util.Map;

/**
 * 数据源抽象 — 任何能产生 IngestRequest 的渠道都要实现这个。
 *
 * <p>典型实现：
 * <ul>
 *   <li>{@code YuqueSource}：调用语雀 API 拉取文档列表/正文</li>
 *   <li>{@code NotionSource}：调用 Notion API 拉取数据库/页面</li>
 *   <li>{@code LocalDirSource}：扫描本地目录的 .md 文件</li>
 *   <li>{@code UrlSource}：抓取 HTTP URL 并转 Markdown</li>
 * </ul>
 */
public interface DataSource {

    /** 数据源唯一标识（用于路由） */
    String getSourceId();

    /** 数据源类型 */
    DataSourceType getType();

    /** 抓取数据（参数来自配置） */
    List<IngestRequest> fetch(Map<String, Object> config) throws Exception;

    /** 是否启用 */
    default boolean isEnabled() { return true; }
}