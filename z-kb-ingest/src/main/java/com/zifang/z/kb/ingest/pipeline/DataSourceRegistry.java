package com.zifang.z.kb.ingest.pipeline;

import com.zifang.z.kb.ingest.api.DataSource;
import com.zifang.z.kb.ingest.api.DataSourceType;
import com.zifang.z.kb.ingest.api.IngestRequest;
import com.zifang.z.kb.ingest.api.IngestResult;
import com.zifang.z.kb.ingest.source.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 数据源注册中心 — 维护 sourceId → DataSource 的映射。
 *
 * <p>内置注册 8 种主流渠道；也可以通过 {@link #register(DataSource)} 自定义。
 */
public class DataSourceRegistry {

    private static final Logger log = LoggerFactory.getLogger(DataSourceRegistry.class);

    private final Map<String, DataSource> sources = new ConcurrentHashMap<>();

    public DataSourceRegistry register(DataSource source) {
        sources.put(source.getSourceId(), source);
        log.info("注册数据源: {} ({})", source.getSourceId(), source.getType());
        return this;
    }

    public DataSource get(String sourceId) {
        return sources.get(sourceId);
    }

    public DataSource require(String sourceId) {
        DataSource s = sources.get(sourceId);
        if (s == null) throw new IllegalArgumentException("数据源未注册: " + sourceId);
        return s;
    }

    public List<DataSource> list() { return new ArrayList<>(sources.values()); }

    public List<DataSource> listByType(DataSourceType type) {
        List<DataSource> out = new ArrayList<>();
        for (DataSource s : sources.values()) if (s.getType() == type) out.add(s);
        return out;
    }

    /** 安装所有内置数据源 */
    public DataSourceRegistry installDefaults() {
        register(new YuqueSource());
        register(new NotionSource());
        register(new ConfluenceSource());
        register(new FeishuSource());
        register(new DingtalkSource());
        register(new GitSource());
        register(new LocalDirSource());
        register(new UrlSource());
        register(new WebhookSource());
        return this;
    }
}