package com.zifang.z.kb.resource.ops;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.overview.WikiPageCounter;
import com.zifang.z.kb.storage.wiki.entity.WikiPageEntity;
import com.zifang.z.kb.storage.wiki.mapper.WikiPageMapper;

/**
 * 概览用 Wiki 页面计数：只统计未下线页面。
 */
public class DefaultWikiPageCounter implements WikiPageCounter {

    private static final String STATUS_DELETED = "DELETED";

    private final WikiPageMapper pageMapper;

    public DefaultWikiPageCounter(WikiPageMapper pageMapper) {
        this.pageMapper = pageMapper;
    }

    @Override
    public long countByKb(String tenantCode, String kbId) {
        Long count = pageMapper.selectCount(new QueryWrapper<WikiPageEntity>()
                .eq("tenant_code", tenantCode)
                .eq("kb_id", kbId)
                .eq("is_deleted", 0)
                .ne("status", STATUS_DELETED));
        return count == null ? 0L : count;
    }
}
