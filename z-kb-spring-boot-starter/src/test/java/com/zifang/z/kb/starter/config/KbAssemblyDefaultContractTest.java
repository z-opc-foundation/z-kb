package com.zifang.z.kb.starter.config;

import com.zifang.z.kb.api.DocumentRepository;
import com.zifang.z.kb.api.KnowledgeGraphStore;
import com.zifang.z.vector.api.VectorStore;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * z-kb 1.1.0 装配口径的<b>契约测试</b>（TASK-20261012-023）。
 *
 * <p>三条口径：
 * <ol>
 *   <li>不改任何配置启动 ⇒ 向量落 {@code PersistentVectorStore}、图谱走 z-graph 引擎；</li>
 *   <li>data-dir 不可写 ⇒ <b>启动失败</b>并给出修复指引（不静默回落内存向量）；</li>
 *   <li>{@code dev} profile ⇒ 回落成 1.0.x 的默认口径（内存向量 + JSON 图谱）。</li>
 * </ol>
 *
 * <p>用<b>真实启动</b>（{@code SpringApplicationBuilder} + {@code @EnableAutoConfiguration}）
 * 而不是 {@code ApplicationContextRunner}：后者只是把配置类直接塞进上下文，
 * 走不到自动装配的<b>排序</b>（dev 回落配置要排在模块自动装配之前才生效），
 * 测出来的就不是线上真实路径。
 */
class KbAssemblyDefaultContractTest {

    private static final String PERSISTENT_VECTOR_STORE = "com.zifang.z.vector.storage.PersistentVectorStore";
    private static final String IN_MEMORY_VECTOR_STORE = "com.zifang.z.vector.core.InMemoryVectorStore";
    private static final String ZGRAPH_STORE = "com.zifang.z.kb.graph.impl.ZGraphKnowledgeGraphStore";
    private static final String JSON_GRAPH_STORE = "com.zifang.z.kb.graph.impl.JsonFileKnowledgeGraphStore";
    private static final String JSON_DOC_REPOSITORY = "com.zifang.z.kb.storage.impl.JsonFileDocumentRepository";

    /** 隔离用的临时 home —— 默认路径（~/.zkb/...）都落在它下面，不污染真实 home。 */
    private Path tempHome;
    private String originalUserHome;

    @BeforeEach
    void isolateHome() throws Exception {
        originalUserHome = System.getProperty("user.home");
        tempHome = Files.createTempDirectory("zkb-contract-home");
        System.setProperty("user.home", tempHome.toString());
    }

    @AfterEach
    void restoreHome() {
        if (originalUserHome == null) {
            System.clearProperty("user.home");
        } else {
            System.setProperty("user.home", originalUserHome);
        }
    }

    @Test
    @DisplayName("不改任何配置启动：向量落 PersistentVectorStore、图谱走 z-graph 引擎")
    void defaultAssemblyIsPersistentVectorAndZGraph() {
        try (ConfigurableApplicationContext ctx = boot()) {
            String vector = ctx.getBean(VectorStore.class).getClass().getName();
            String graph = ctx.getBean(KnowledgeGraphStore.class).getClass().getName();
            String doc = ctx.getBean(DocumentRepository.class).getClass().getName();

            System.out.println("READING-DEFAULT vectorStore  = " + vector);
            System.out.println("READING-DEFAULT graphStore   = " + graph);
            System.out.println("READING-DEFAULT docRepository = " + doc);

            assertEquals(PERSISTENT_VECTOR_STORE, vector, "默认向量存储不是 PersistentVectorStore");
            assertEquals(ZGRAPH_STORE, graph, "默认图谱存储不是 z-graph 引擎实现");
            assertEquals(JSON_DOC_REPOSITORY, doc, "文档仓库默认应当仍是 JSON 持久化");
        }
    }

    @Test
    @DisplayName("拔掉 data-dir 权限：启动报错并带修复指引（不静默回落内存向量）")
    void unwritableDataDirFailsStartupWithGuidance() throws Exception {
        Path locked = tempHome.resolve("locked-vector-dir");
        Files.createDirectories(locked);
        // 拔掉写权限（目录变成 r-x）
        assertTrue(locked.toFile().setWritable(false, false), "未能拔掉目录写权限");
        Files.setPosixFilePermissions(locked, java.nio.file.attribute.PosixFilePermissions.fromString("r-xr-xr-x"));

        String dataDir;
        if (Files.isWritable(locked)) {
            // 以 root 跑时权限位形同虚设 ⇒ 换一种同样"目录不可用"的形态：
            // 让 data-dir 落在一个**普通文件**底下，createDirectories 必然失败。
            Path blocker = tempHome.resolve("blocker-file");
            Files.write(blocker, "not-a-directory".getBytes(StandardCharsets.UTF_8));
            dataDir = blocker.resolve("vector").toString();
            System.out.println("NOTE-FAILFAST 以 root 运行，权限位无效 ⇒ 改用「普通文件底下建目录」形态");
        } else {
            dataDir = locked.toString();
        }

        Exception failure = assertThrows(Exception.class,
                () -> boot("zkb.vector.data-dir=" + dataDir),
                "data-dir 不可用却启动成功了（说明在静默回落）");
        String text = stackTrace(failure);
        System.out.println("READING-FAILFAST " + firstCauseMessage(failure));

        assertTrue(text.contains("修复指引"), "失败信息里没有修复指引：\n" + text);
        assertTrue(text.contains("z-vector-storage"), "失败信息里没有「补 z-vector-storage 依赖」的指引：\n" + text);
        assertTrue(text.contains("data-dir"), "失败信息里没有 data-dir：\n" + text);
    }

    @Test
    @DisplayName("dev profile：回落成 1.0.x 默认口径（内存向量 + JSON 图谱）")
    void devProfileFallsBackToLegacyDefaults() {
        try (ConfigurableApplicationContext ctx = boot("spring.profiles.active=dev")) {
            String vector = ctx.getBean(VectorStore.class).getClass().getName();
            String graph = ctx.getBean(KnowledgeGraphStore.class).getClass().getName();
            String doc = ctx.getBean(DocumentRepository.class).getClass().getName();

            System.out.println("READING-DEV vectorStore  = " + vector);
            System.out.println("READING-DEV graphStore   = " + graph);
            System.out.println("READING-DEV docRepository = " + doc);

            assertEquals(IN_MEMORY_VECTOR_STORE, vector, "dev profile 未回落到内存向量");
            assertEquals(JSON_GRAPH_STORE, graph, "dev profile 未回落到 JSON 图谱");
            assertEquals(JSON_DOC_REPOSITORY, doc, "文档仓库口径不受 dev profile 影响");
        }
    }

    @Test
    @DisplayName("非法 storage-type / graph.engine：启动报错并带修复指引")
    void illegalValuesFailFastWithGuidance() {
        Exception vectorFailure = assertThrows(Exception.class,
                () -> boot("zkb.vector.storage-type=bogus"), "非法 storage-type 未报错");
        assertTrue(stackTrace(vectorFailure).contains("修复指引"));

        Exception graphFailure = assertThrows(Exception.class,
                () -> boot("zkb.graph.engine=bogus"), "非法 graph.engine 未报错");
        assertTrue(stackTrace(graphFailure).contains("修复指引"));
    }

    @Test
    @DisplayName("显式回旧档：storage-type=in-memory + graph.engine=json 都能落回 1.0.x 口径")
    void explicitLegacyConfigStillWorks() {
        try (ConfigurableApplicationContext ctx = boot(
                "zkb.vector.storage-type=in-memory",
                "zkb.graph.engine=json")) {
            assertEquals(IN_MEMORY_VECTOR_STORE, ctx.getBean(VectorStore.class).getClass().getName());
            assertEquals(JSON_GRAPH_STORE, ctx.getBean(KnowledgeGraphStore.class).getClass().getName());
        }
    }

    // ------------------------------------------------------------------ 工具

    /** 真实启动（无 web、无 banner），返回上下文。 */
    private ConfigurableApplicationContext boot(String... properties) {
        return new SpringApplicationBuilder(TestApp.class)
                .web(WebApplicationType.NONE)
                .properties("spring.main.banner-mode=off")
                .properties(properties)
                .run();
    }

    private static String stackTrace(Throwable t) {
        StringWriter sw = new StringWriter();
        t.printStackTrace(new PrintWriter(sw));
        return sw.toString();
    }

    private static String firstCauseMessage(Throwable t) {
        Throwable cur = t;
        while (cur.getCause() != null) {
            cur = cur.getCause();
        }
        return cur.getClass().getSimpleName() + ": " + cur.getMessage();
    }

    /** 只开自动装配、不做组件扫描 —— 装配结果完全由 classpath 上的 AutoConfiguration.imports 决定。 */
    @EnableAutoConfiguration
    static class TestApp {
    }
}
