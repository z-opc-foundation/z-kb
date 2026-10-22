package com.zifang.z.kb.starter.config;

import com.zifang.z.kb.api.KbPaths;
import com.zifang.z.kb.api.KnowledgeGraphStore;
import com.zifang.z.kb.graph.impl.JsonFileKnowledgeGraphStore;
import com.zifang.z.vector.api.VectorStore;
import com.zifang.z.vector.core.InMemoryVectorStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Profile;

/**
 * dev profile 的<b>全套回落</b>（1.1.0 起）。
 *
 * <p>1.1.0 把默认口径翻成「向量 persistent + 图谱 z-graph」，而这两样都是<b>生产口径</b>：
 * <ul>
 *   <li>向量要落盘（{@code PersistentVectorStore}），data-dir 得可写；</li>
 *   <li>图谱走 z-graph 引擎（进程内）。</li>
 * </ul>
 *
 * <p>dev profile 下则整套回落成 <b>内存向量 + JSON 图谱</b> —— 也就是 z-kb 1.0.x 的默认口径，
 * 与 z-lc 的 dev H2 家族惯例一致：本地零外部依赖启动，脏数据不落到共享目录。
 *
 * <p>为什么要单独一个类而不是把判断塞进两个模块的自动装配：
 * <ul>
 *   <li>「dev 下回落什么」是一<b>整套</b>口径，拆到两个模块里各判一半容易走偏；</li>
 *   <li>{@code @Profile("dev")} 让它只在 dev 生效，生产路径完全不受影响。</li>
 * </ul>
 *
 * <p>{@code @AutoConfigureBefore} 保证它排在模块自带的自动装配之前，
 * 这样模块那边 {@code @ConditionalOnMissingBean} 就会退让（而不是反过来抢 Bean）。
 */
@AutoConfiguration
@Profile("dev")
@org.springframework.boot.autoconfigure.AutoConfigureBefore(name = {
        "com.zifang.z.kb.vector.autoconfigure.ChunkVectorStoreAutoConfiguration",
        "com.zifang.z.kb.graph.autoconfigure.KnowledgeGraphStoreAutoConfiguration"})
public class KBDevProfileAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(KBDevProfileAutoConfiguration.class);

    /** 宿主自带 z-vector 自动装配时的类名 —— 宿主有向量实现时，dev 回落不跟它抢。 */
    static final String HOST_VECTOR_AUTO_CONFIG = "com.zifang.z.vector.starter.autoconfigure.ZVectorAutoConfiguration";

    /**
     * dev 回落：内存向量（重启不保留，但也不占磁盘、不需要可写目录）。
     *
     * <p>只在<b>宿主没有 z-vector 自动装配</b>时注册：宿主自带向量实现（z-vector 自动装配或宿主
     * 内嵌面）时，dev 回落再插一个 {@code VectorStore} 会让同类型注入变成多候选
     * （{@code NoUniqueBeanDefinitionException}），向量归属仍归宿主。
     */
    @org.springframework.context.annotation.Configuration(proxyBeanMethods = false)
    @org.springframework.boot.autoconfigure.condition.ConditionalOnMissingClass(HOST_VECTOR_AUTO_CONFIG)
    static class DevVectorStoreConfiguration {

        @Bean(destroyMethod = "close")
        @ConditionalOnMissingBean(VectorStore.class)
        public VectorStore devVectorStore() {
            VectorStore store = new InMemoryVectorStore();
            log.info("z-kb dev profile 生效：向量存储回落为 {}（内存向量，重启不保留）",
                    store.getClass().getName());
            return store;
        }
    }

    /** dev 回落：JSON 图谱（保留 1.0.x 的文件持久化口径，便于本地复现线上数据形状）。 */
    @Bean(destroyMethod = "close")
    @ConditionalOnMissingBean(KnowledgeGraphStore.class)
    public KnowledgeGraphStore devGraphStore(@Value("${zkb.graph.path:#{null}}") String path) {
        String dir = (path == null || path.trim().isEmpty())
                ? KbPaths.graphDir() : KbPaths.expand(path);
        KnowledgeGraphStore store = new JsonFileKnowledgeGraphStore(dir);
        log.info("z-kb dev profile 生效：图谱存储回落为 {}（JSON 文件持久化, dir={}）",
                store.getClass().getName(), dir);
        return store;
    }
}
