package com.zifang.z.kb.api;

/**
 * 实体类型 — 简化分类，兼容 NER 通用标签集。
 *
 * <p>实际生产可基于规则词典 + HanLP NER 自动识别。
 */
public enum EntityType {
    PERSON,        // 人名
    ORGANIZATION,  // 组织/公司
    LOCATION,      // 地点
    TECHNOLOGY,    // 技术/产品/语言
    CONCEPT,       // 抽象概念
    METHOD,        // 方法/算法
    TOOL,          // 工具/框架
    DATABASE,      // 数据库
    METRIC,        // 指标/数值
    EVENT,         // 事件
    DATE,          // 日期
    OTHER          // 其他
}
