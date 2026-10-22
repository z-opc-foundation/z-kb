package com.zifang.z.kb.graph.autoconfigure;

import com.zifang.z.kb.api.KbPaths;
import com.zifang.z.kb.api.KnowledgeGraphStore;
import com.zifang.z.kb.graph.impl.JsonFileKnowledgeGraphStore;
import com.zifang.z.kb.graph.impl.ZGraphKnowledgeGraphStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;

/**
 * z-kb-graph Spring Boot 自动装配。
 *
 * <p><b>1.1.0 破坏性变更</b>：新增 {@code zkb.graph.engine} 开关，默认由「只有 JSON 文件」
 * 翻成 {@code zgraph}（走 z-graph 引擎），取值 {@code zgraph}（默认）/ {@code json}。
 * 要回到 1.0.x 的 JSON 文件口径请显式配 {@code zkb.graph.engine=json}。
 *
 * <p>两个引擎的差别要说清楚：
 * <ul>
 *   <li>{@code zgraph} ⇒ {@link ZGraphKnowledgeGraphStore}，底层是 z-graph 的
 *       {@code com.zifang.z.graph.core.InMemoryGraphStore}（<b>进程内图谱，重启不保留</b>）；</li>
 *   <li>{@code json} ⇒ {@link JsonFileKnowledgeGraphStore}，一工作台一份 JSON，
 *       <b>重启不丢数据</b>（目录默认 {@code ~/.zkb/graph}，可用 {@code zkb.graph.path} 覆盖）。</li>
 * </ul>
 */
@org.springframework.boot.autoconfigure.AutoConfiguration
public class KnowledgeGraphStoreAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeGraphStoreAutoConfiguration.class);

    @Bean(destroyMethod = "close")
    @ConditionalOnMissingBean(KnowledgeGraphStore.class)
    public KnowledgeGraphStore knowledgeGraphStore(
            @Value("${zkb.graph.engine:zgraph}") String engine,
            @Value("${zkb.graph.path:#{null}}") String path) {
        String e = engine == null ? "" : engine.trim();
        if ("zgraph".equalsIgnoreCase(e)) {
            KnowledgeGraphStore store = new ZGraphKnowledgeGraphStore();
            log.info("z-kb 图谱存储后端：{}（zkb.graph.engine=zgraph，"
                            + "底层 z-graph 引擎 com.zifang.z.graph.core.InMemoryGraphStore）",
                    store.getClass().getName());
            return store;
        }
        if ("json".equalsIgnoreCase(e)) {
            String dir = (path == null || path.trim().isEmpty())
                    ? KbPaths.graphDir() : KbPaths.expand(path);
            KnowledgeGraphStore store = new JsonFileKnowledgeGraphStore(dir);
            log.info("z-kb 图谱存储后端：{}（zkb.graph.engine=json, dir={}）",
                    store.getClass().getName(), dir);
            return store;
        }
        throw new IllegalStateException(
                "z-kb 启动失败：zkb.graph.engine 取值非法 —— '" + e + "'。"
                        + "修复指引：只接受 zgraph（1.1.0 起的默认，走 z-graph 引擎，进程内图谱重启不保留）"
                        + "或 json（JSON 文件持久化，重启不丢数据）；请检查 zkb.graph.engine 配置。");
    }
}
