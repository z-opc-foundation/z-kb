package com.zifang.z.kb.vector.autoconfigure;

import com.zifang.z.kb.api.ChunkVectorStore;
import com.zifang.z.kb.api.EmbeddingProvider;
import com.zifang.z.kb.api.KbPaths;
import com.zifang.z.kb.vector.impl.ZVectorChunkVectorStore;
import com.zifang.z.vector.api.VectorStore;
import com.zifang.z.vector.core.InMemoryVectorStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

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
 */
@org.springframework.boot.autoconfigure.AutoConfiguration
@ConditionalOnClass(VectorStore.class)
@EnableConfigurationProperties(ChunkVectorStoreProperties.class)
public class ChunkVectorStoreAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(ChunkVectorStoreAutoConfiguration.class);

    /** 持久化向量存储实现类名（反射加载：z-vector-storage 是可选依赖，缺了要报错而不是回落）。 */
    static final String PERSISTENT_STORE_CLASS = "com.zifang.z.vector.storage.PersistentVectorStore";

    @Bean(destroyMethod = "close")
    @ConditionalOnMissingBean(VectorStore.class)
    public VectorStore vectorStore(ChunkVectorStoreProperties props) {
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

    @Bean
    @ConditionalOnMissingBean(ChunkVectorStore.class)
    public ChunkVectorStore chunkVectorStore(VectorStore vectorStore,
                                              ChunkVectorStoreProperties props,
                                              @Autowired(required = false) EmbeddingProvider embeddingProvider) {
        int dim = props.getDimension();
        if (embeddingProvider != null) dim = embeddingProvider.dimension();
        return new ZVectorChunkVectorStore(vectorStore, dim);
    }

    /**
     * 反射加载持久化向量存储；<b>任何失败都直接抛</b>（不再回落内存向量）。
     */
    private VectorStore createPersistent(String dataDir) {
        try {
            Class<?> clazz = Class.forName(PERSISTENT_STORE_CLASS);
            return (VectorStore) clazz.getDeclaredConstructor(String.class).newInstance(dataDir);
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException(persistentFailureMessage(dataDir,
                    "类 " + PERSISTENT_STORE_CLASS + " 不在 classpath 上（依赖 io.github.yuku123:z-vector-storage 没被引入）"), e);
        } catch (InvocationTargetException e) {
            Throwable cause = e.getTargetException() == null ? e : e.getTargetException();
            throw new IllegalStateException(persistentFailureMessage(dataDir,
                    "初始化失败：" + cause.getClass().getSimpleName() + ": " + cause.getMessage()), cause);
        } catch (Exception e) {
            throw new IllegalStateException(persistentFailureMessage(dataDir,
                    "初始化失败：" + e.getClass().getSimpleName() + ": " + e.getMessage()), e);
        }
    }

    /** 失败信息里必须带修复指引 —— 现场拿到这一行就知道下一步干什么。 */
    private String persistentFailureMessage(String dataDir, String reason) {
        return "z-kb 启动失败：持久化向量存储不可用（zkb.vector.storage-type=persistent, data-dir="
                + dataDir + "）—— " + reason
                + "。修复指引："
                + "① 确认依赖已引入 io.github.yuku123:z-vector-storage（z-kb-vector 的传递依赖）；"
                + "② 确认 data-dir 目录存在且当前进程用户可写（ls -ld / chmod u+w / chown）；"
                + "③ 若确需退回内存向量，显式配置 zkb.vector.storage-type=in-memory"
                + "（注意：内存向量重启后不保留）。";
    }
}
