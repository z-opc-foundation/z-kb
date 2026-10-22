package com.zifang.z.kb.vector.autoconfigure;

import com.zifang.z.kb.api.ChunkVectorStore;
import com.zifang.z.kb.api.EmbeddingProvider;
import com.zifang.z.kb.api.KbPaths;
import com.zifang.z.kb.vector.impl.ZVectorChunkVectorStore;
import com.zifang.z.vector.api.VectorStore;
import com.zifang.z.vector.core.InMemoryVectorStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ListableBeanFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingClass;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PreDestroy;
import java.lang.reflect.InvocationTargetException;

/**
 * z-kb-vector Spring Boot 自动装配。
 *
 * <p><b>1.1.0 破坏性变更（fail-fast）</b>：{@code zkb.vector.storage-type} 默认由
 * {@code in-memory} 翻成 {@code persistent}；而 persistent 模式下
 * {@code PersistentVectorStore} 装不上时<b>启动直接失败</b>，不再静默回落成内存向量 ——
 * 静默回落的后果是「服务起来了、向量写进了内存、重启全丢」，现场根本看不出来。
 *
 * <p>失败时抛出的异常里带<b>修复指引</b>（补依赖 / 检查 data-dir 可写 / 显式回旧档）。
 *
 * <p><b>向量库归属规则（1.1.0 起写死，不再靠自动装配顺序）</b>：
 * <ul>
 *   <li><b>宿主带 z-vector 自动装配</b>（{@code com.zifang.z.vector.starter.autoconfigure.ZVectorAutoConfiguration}
 *       在 classpath 上）⇒ <b>向量库归宿主</b>：z-kb <b>不</b>注册自己的 {@code VectorStore} bean，
 *       改为按固定优先级取用宿主已存在的那个（优先规范 bean 名 {@code vectorStore}）。
 *       理由：宿主（z-opc）本来就有 {@code vectorStore}（z-vector 自动装配）与
 *       {@code zVectorVectorStore}（宿主内嵌面）<b>两个</b> {@code VectorStore}，
 *       z-kb 若再注册一个，同类型注入直接 {@code NoUniqueBeanDefinitionException} 启动失败；
 *       而 z-kb 抢先把 {@code vectorStore} 这个名字占了，宿主的向量实现就被顶掉 ⇒ 宿主行为被改。</li>
 *   <li><b>宿主没有 z-vector 自动装配</b> ⇒ z-kb 自建向量库，bean 名改成 {@code kbVectorStore}
 *       （不再叫 {@code vectorStore}，免得和 z-vector 的同名 bean 在同一容器里撞名），
 *       默认 persistent，装不上即启动失败。</li>
 * </ul>
 */
@org.springframework.boot.autoconfigure.AutoConfiguration
@ConditionalOnClass(VectorStore.class)
@EnableConfigurationProperties(ChunkVectorStoreProperties.class)
public class ChunkVectorStoreAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(ChunkVectorStoreAutoConfiguration.class);

    /** 持久化向量存储实现类名（反射加载：z-vector-storage 是可选依赖，缺了要报错而不是回落）。 */
    static final String PERSISTENT_STORE_CLASS = "com.zifang.z.vector.storage.PersistentVectorStore";

    /** 宿主自带 z-vector 自动装配时的类名 —— 判定「向量库归宿主」。 */
    static final String HOST_VECTOR_AUTO_CONFIG = "com.zifang.z.vector.starter.autoconfigure.ZVectorAutoConfiguration";

    /** z-vector 自动装配给宿主提供的规范 bean 名。 */
    static final String HOST_VECTOR_BEAN = "vectorStore";

    /** z-kb 自建向量库的 bean 名（1.1.0 起不再是 "vectorStore"）。 */
    static final String KB_VECTOR_BEAN = "kbVectorStore";

    /** 宿主一个向量实现都没有时 z-kb 自建的兜底 store（不在容器里，单独负责关）。 */
    private volatile VectorStore fallbackStore;

    /**
     * z-kb 自建向量库 —— <b>仅在宿主没有 z-vector 自动装配时</b>才注册。
     *
     * <p>放在嵌套类里而不是直接在 {@code @Bean} 方法上挂 {@code @ConditionalOnMissingClass}：
     * 条件注解挂在 TYPE 上判定时机更稳（配置类解析期），不受自动装配排序影响。
     */
    @Configuration(proxyBeanMethods = false)
    @ConditionalOnMissingClass(HOST_VECTOR_AUTO_CONFIG)
    static class OwnVectorStoreConfiguration {

        @Bean(name = KB_VECTOR_BEAN, destroyMethod = "close")
        @ConditionalOnMissingBean(VectorStore.class)
        public VectorStore kbVectorStore(ChunkVectorStoreProperties props) {
            VectorStore store = createStore(props);
            log.info("z-kb 自建向量存储后端：{}（storage-type={}, data-dir={}）",
                    store.getClass().getName(), props.getStorageType(), props.getDataDir());
            return store;
        }
    }

    @Bean
    @ConditionalOnMissingBean(ChunkVectorStore.class)
    public ChunkVectorStore chunkVectorStore(ListableBeanFactory beanFactory,
                                              ChunkVectorStoreProperties props,
                                              @Autowired(required = false) EmbeddingProvider embeddingProvider) {
        VectorStore store = resolveVectorStore(beanFactory);
        if (store == null) {
            // 宿主连 z-vector 自动装配都没有（或者把它 exclude 掉了）⇒ z-kb 自建，fail-fast 口径不变。
            store = createStore(props);
            fallbackStore = store;
            log.info("z-kb 向量存储后端：{}（宿主没有任何 VectorStore 实现，z-kb 自建；"
                            + "storage-type={}, data-dir={}）",
                    store.getClass().getName(), props.getStorageType(), props.getDataDir());
        }
        int dim = props.getDimension();
        if (embeddingProvider != null) dim = embeddingProvider.dimension();
        return new ZVectorChunkVectorStore(store, dim);
    }

    /**
     * 取用向量库的<b>固定优先级</b>（不依赖自动装配注册顺序）：
     * <ol>
     *   <li>z-vector 自动装配的规范 bean 名 {@code vectorStore}；</li>
     *   <li>z-kb 自建的 {@code kbVectorStore}；</li>
     *   <li>容器里唯一的 {@code VectorStore}；</li>
     *   <li>仍有多个且都不是上面两个 ⇒ 取名字序最小者，并把候选全名打进日志（让人能自己判断）。</li>
     * </ol>
     *
     * @return 宿主已有的向量实现；一个都没有时返回 {@code null}（由调用方自建）
     */
    private VectorStore resolveVectorStore(ListableBeanFactory beanFactory) {
        String[] names = beanFactory.getBeanNamesForType(VectorStore.class);
        if (names == null || names.length == 0) {
            return null;
        }
        for (String preferred : new String[]{HOST_VECTOR_BEAN, KB_VECTOR_BEAN}) {
            for (String n : names) {
                if (preferred.equals(n)) {
                    VectorStore store = beanFactory.getBean(n, VectorStore.class);
                    log.info("z-kb 向量存储：复用容器内已有实现（bean={}, class={}）",
                            n, store.getClass().getName());
                    return store;
                }
            }
        }
        if (names.length == 1) {
            VectorStore store = beanFactory.getBean(names[0], VectorStore.class);
            log.info("z-kb 向量存储：复用容器内唯一实现（bean={}, class={}）",
                    names[0], store.getClass().getName());
            return store;
        }
        String pick = java.util.Arrays.stream(names).sorted().findFirst().orElse(names[0]);
        log.warn("z-kb 向量存储：容器内有多份 VectorStore 实现（{}），按固定规则取名字序最小者 {}；"
                        + "如需指定，请自行注册名为 {} 的 bean",
                String.join(", ", names), pick, HOST_VECTOR_BEAN);
        return beanFactory.getBean(pick, VectorStore.class);
    }

    /**
     * 按配置创建向量存储实现（persistent 默认，装不上即失败）。
     */
    private static VectorStore createStore(ChunkVectorStoreProperties props) {
        String type = props.getStorageType() == null ? "" : props.getStorageType().trim();
        if ("persistent".equalsIgnoreCase(type)) {
            String dir = KbPaths.expand(props.getDataDir());
            VectorStore store = createPersistent(dir);
            log.info("z-kb 向量存储后端：{}（storage-type=persistent, data-dir={}）",
                    store.getClass().getName(), dir);
            return store;
        }
        if ("in-memory".equalsIgnoreCase(type)) {
            VectorStore store = new InMemoryVectorStore();
            log.info("z-kb 向量存储后端：{}（storage-type=in-memory）", store.getClass().getName());
            return store;
        }
        throw new IllegalStateException(
                "z-kb 启动失败：zkb.vector.storage-type 取值非法 —— '" + type + "'。"
                        + "修复指引：只接受 persistent（1.1.0 起的默认，向量落 PersistentVectorStore，重启不丢）"
                        + "或 in-memory（内存向量，重启不保留）；请检查 zkb.vector.storage-type 配置。");
    }

    /**
     * 反射加载持久化向量存储；<b>任何失败都直接抛</b>（不再回落内存向量）。
     */
    private static VectorStore createPersistent(String dataDir) {
        try {
            Class<?> clazz = Class.forName(PERSISTENT_STORE_CLASS);
            return (VectorStore) clazz.getDeclaredConstructor(String.class).newInstance(dataDir);
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException(persistentFailureMessage(dataDir,
                    "类 " + PERSISTENT_STORE_CLASS + " 不在 classpath 上（依赖 io.github.yuku123:z-vector-storage 没被引入）"), e);
        } catch (InvocationTargetException e) {
            Throwable cause = e.getTargetException() == null ? e : e.getTargetException();
            throw new IllegalStateException(persistentFailureMessage(dataDir,
                    "初始化失败：" + cause.getClass().getSimpleName() + ": " + cause.getMessage()), e);
        } catch (Exception e) {
            throw new IllegalStateException(persistentFailureMessage(dataDir,
                    "初始化失败：" + e.getClass().getSimpleName() + ": " + e.getMessage()), e);
        }
    }

    /** 失败信息里必须带修复指引 —— 现场拿到这一行就知道下一步干什么。 */
    private static String persistentFailureMessage(String dataDir, String reason) {
        return "z-kb 启动失败：持久化向量存储不可用（zkb.vector.storage-type=persistent, data-dir="
                + dataDir + "）—— " + reason
                + "。修复指引："
                + "① 确认依赖已引入 io.github.yuku123:z-vector-storage（z-kb-vector 的传递依赖）；"
                + "② 确认 data-dir 目录存在且当前进程用户可写（ls -ld / chmod u+w / chown）；"
                + "③ 若确需退回内存向量，显式配置 zkb.vector.storage-type=in-memory"
                + "（注意：内存向量重启后不保留）。";
    }

    /** 兜底自建的 store 不在容器里 ⇒ 由本类负责关。 */
    @PreDestroy
    public void closeFallbackStore() {
        VectorStore store = fallbackStore;
        if (store != null) {
            try {
                store.close();
            } catch (Exception e) {
                log.warn("z-kb 关闭兜底向量存储失败：{}", e.getMessage());
            }
        }
    }
}
