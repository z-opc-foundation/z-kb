package com.zifang.z.kb.api.overview;

/**
 * Wiki 页面计数来源。Wiki 域未装配时返回 0，概览据此标注口径。
 */
public interface WikiPageCounter {

    long countByKb(String tenantCode, String kbId);
}
