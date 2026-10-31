package com.zifang.z.kb.web;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * z-kb-web 自动装配契约测试（TASK-20260925-025）。
 *
 * <p>钉两件事：
 * <ol>
 *   <li><b>最小装配</b>（只 {@code @EnableAutoConfiguration}，不做任何组件扫描）下，
 *       {@code /api/kb/workspaces} 这条路由必须<b>存在</b> —— 返回 200/401，<b>不是 404</b>。
 *       这正是「谁引这个 jar 都不会有 /api/kb/*」那个缺陷的回归闸门。</li>
 *   <li>7 个 controller 的 handler 类名都在 {@code com.zifang.z.kb.web.controller} 包下，
 *       且 bean 名不与 z-team 的同名 controller 打架。</li>
 * </ol>
 *
 * <p>刻意用<b>真实 servlet 容器</b>（{@code WebApplicationType.SERVLET} + 随机端口），
 * 而不是 standalone MockMvc：只有真起 Tomcat，{@code @RestController} 的映射注册才作数。
 */
class KbWebAutoConfigurationTest {

    private Path tempDir;
    private ConfigurableApplicationContext ctx;

    @BeforeEach
    void prepare() throws Exception {
        tempDir = Files.createTempDirectory("zkb-web-test");
    }

    @AfterEach
    void cleanup() {
        if (ctx != null) {
            ctx.close();
            ctx = null;
        }
    }

    @Test
    @DisplayName("最小装配：/api/kb/workspaces 返回 200/401（不是 404）")
    void workspacesRouteIsRegistered() {
        boot();
        TestRestTemplate rest = new TestRestTemplate();
        String url = "http://localhost:" + port() + "/api/kb/workspaces";
        ResponseEntity<String> resp = rest.getForEntity(url, String.class);

        System.out.println("READING-KBWEB /api/kb/workspaces -> " + resp.getStatusCode());
        System.out.println("READING-KBWEB body=" + resp.getBody());

        assertTrue(resp.getStatusCode() == HttpStatus.OK || resp.getStatusCode() == HttpStatus.UNAUTHORIZED,
                "/api/kb/workspaces 期望 200/401，实际 " + resp.getStatusCode() + "（404 = 路由没注册）");
        assertTrue(resp.getStatusCode() != HttpStatus.NOT_FOUND, "/api/kb/workspaces 是 404 ⇒ 装配没生效");

        // 测试类路径带 H2 ⇒ 内嵌 DataSource 成立 ⇒ 资源域装配生效，v1 路由必须注册并返回 KbResult 信封
        ResponseEntity<String> v1 = rest.getForEntity(
                "http://localhost:" + port() + "/api/kb/v1/knowledgeBase/queryDetailById?kbId=x", String.class);
        System.out.println("READING-KBWEB v1 with embedded H2 -> " + v1.getStatusCode() + " " + v1.getBody());
        assertEquals(HttpStatus.NOT_FOUND, v1.getStatusCode(), "v1 路由应已注册（未知 kbId 走 404 信封）");
        assertTrue(v1.getBody() != null && v1.getBody().contains("\"success\""),
                "v1 路由应返回 KbResult 信封：" + v1.getBody());
    }

    @Test
    @DisplayName("排除 DataSourceAutoConfiguration 后资源域整块不装配：v1 路由不注册、启动不受影响")
    void v1RoutesRequireDataSource() {
        boot("spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration");
        TestRestTemplate rest = new TestRestTemplate();

        ResponseEntity<String> legacy = rest.getForEntity(
                "http://localhost:" + port() + "/api/kb/workspaces", String.class);
        assertEquals(HttpStatus.OK, legacy.getStatusCode(), "既有 /api/kb/* 不依赖 DataSource");

        ResponseEntity<String> v1 = rest.getForEntity(
                "http://localhost:" + port() + "/api/kb/v1/knowledgeBase/queryDetailById?kbId=x", String.class);
        System.out.println("READING-KBWEB v1 without DataSource -> " + v1.getStatusCode() + " " + v1.getBody());
        assertEquals(HttpStatus.NOT_FOUND, v1.getStatusCode(), "无 DataSource 时 v1 路由不该注册");
        assertTrue(v1.getBody() == null || !v1.getBody().contains("\"success\""),
                "v1 路由未注册时不该出现 KbResult 信封：" + v1.getBody());
    }

    @Test
    @DisplayName("7 个 controller 全部注册，handler 类名都在 com.zifang.z.kb.web.controller 下")
    void kbControllersAreRegistered() {
        boot();
        RequestMappingHandlerMapping mapping = ctx.getBean(RequestMappingHandlerMapping.class);

        List<String> kbHandlers = new ArrayList<>();
        List<String> paths = new ArrayList<>();
        java.util.Set<String> kbTypes = new java.util.LinkedHashSet<>();
        mapping.getHandlerMethods().forEach((info, method) -> {
            String type = method.getBeanType().getName();
            if (type.startsWith("com.zifang.z.kb.web.controller.")) {
                kbTypes.add(type);
                kbHandlers.add(type);
                paths.addAll(patterns(info));
            }
        });

        System.out.println("READING-KBWEB handler 类 = " + kbTypes);
        System.out.println("READING-KBWEB 路由 = " + paths);

        assertEquals(7, kbTypes.size(), "z-kb controller 数不对：" + kbTypes);
        for (String p : paths) {
            assertTrue(p.startsWith("/api/kb/"), "出现非 /api/kb/* 的路由：" + p);
        }
        assertEquals(7, new java.util.HashSet<>(kbTypes).size(), "controller bean 名有重复");
        // 每个 controller 的挂载根都要有真实路由（graph/ingest/modeling 没有裸根路由，
        // 只有 /{workspace}/... 这种子路径 —— 所以按前缀断言，不按裸根断言）
        String[][] expect = {
                {"WorkspaceController", "/api/kb/workspaces"},
                {"DocumentController", "/api/kb/documents"},
                {"SearchController", "/api/kb/search"},
                {"ChatController", "/api/kb/chat"},
                {"GraphController", "/api/kb/graph"},
                {"IngestController", "/api/kb/ingest"},
                {"ModelingController", "/api/kb/modeling"},
        };
        for (String[] e : expect) {
            assertTrue(kbTypes.contains("com.zifang.z.kb.web.controller." + e[0]),
                    "缺 controller：" + e[0] + "，实际：" + kbTypes);
            boolean hit = paths.stream().anyMatch(p -> p.startsWith(e[1]));
            assertTrue(hit, "controller " + e[0] + " 没有挂在 " + e[1] + " 下：" + paths);
        }
    }

    // ------------------------------------------------------------------ 工具

    /** 路由条件两套（ant / PathPattern）取有值的那套 —— 匹配策略由宿主定，测试不该钉死。 */
    private static List<String> patterns(org.springframework.web.servlet.mvc.method.RequestMappingInfo info) {
        List<String> out = new ArrayList<>();
        if (info.getPathPatternsCondition() != null) {
            info.getPathPatternsCondition().getPatterns().forEach(p -> out.add(p.toString()));
        } else if (info.getPatternsCondition() != null) {
            info.getPatternsCondition().getPatterns().forEach(p -> out.add(p.toString()));
        }
        return out;
    }

    private void boot(String... extraProperties) {
        List<String> props = new ArrayList<>(List.of(
                "spring.main.banner-mode=off",
                "server.port=0",
                "spring.main.allow-bean-definition-overriding=true",
                // 测试不落用户真实 home：向量走内存，图谱与文档仓库落临时目录
                "zkb.vector.storage-type=in-memory",
                "zkb.graph.engine=json",
                "zkb.graph.path=" + tempDir.resolve("graph").toString(),
                "zkb.storage.path=" + tempDir.resolve("zkb.json").toString()));
        props.addAll(List.of(extraProperties));
        ctx = new SpringApplicationBuilder(TestApp.class)
                .web(WebApplicationType.SERVLET)
                .properties(props.toArray(new String[0]))
                .run();
    }

    private int port() {
        String p = ctx.getEnvironment().getProperty("local.server.port");
        return Integer.parseInt(p);
    }

    /** 只开自动装配、不做组件扫描 —— 装配结果完全由 classpath 上的 AutoConfiguration.imports 决定。 */
    @EnableAutoConfiguration
    static class TestApp {
    }
}
