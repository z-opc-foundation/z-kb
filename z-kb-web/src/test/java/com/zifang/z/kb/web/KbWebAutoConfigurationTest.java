package com.zifang.z.***REMOVED***.web;

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
 * z-***REMOVED***-web 自动装配契约测试（TASK-20260925-025）。
 *
 * <p>钉两件事：
 * <ol>
 *   <li><b>最小装配</b>（只 {@code @EnableAutoConfiguration}，不做任何组件扫描）下，
 *       {@code /api/***REMOVED***/workspaces} 这条路由必须<b>存在</b> —— 返回 200/401，<b>不是 404</b>。
 *       这正是「谁引这个 jar 都不会有 /api/***REMOVED***/*」那个缺陷的回归闸门。</li>
 *   <li>7 个 controller 的 handler 类名都在 {@code com.zifang.z.***REMOVED***.web.controller} 包下，
 *       且 bean 名不与 z-team 的同名 controller 打架。</li>
 * </ol>
 *
 * <p>刻意用<b>真实 servlet 容器</b>（{@code WebApplicationType.SERVLET} + 随机端口），
 * 而不是 standalone MockMvc：只有真起 Tomcat，{@code @RestController} 的映射注册才作数。
 */
class ***REMOVED***WebAutoConfigurationTest {

    private Path tempDir;
    private ConfigurableApplicationContext ctx;

    @BeforeEach
    void prepare() throws Exception {
        tempDir = Files.createTempDirectory("***REMOVED***-web-test");
    }

    @AfterEach
    void cleanup() {
        if (ctx != null) {
            ctx.close();
            ctx = null;
        }
    }

    @Test
    @DisplayName("最小装配：/api/***REMOVED***/workspaces 返回 200/401（不是 404）")
    void workspacesRouteIsRegistered() {
        boot();
        TestRestTemplate rest = new TestRestTemplate();
        String url = "http://localhost:" + port() + "/api/***REMOVED***/workspaces";
        ResponseEntity<String> resp = rest.getForEntity(url, String.class);

        System.out.println("READING-***REMOVED***WEB /api/***REMOVED***/workspaces -> " + resp.getStatusCode());
        System.out.println("READING-***REMOVED***WEB body=" + resp.getBody());

        assertTrue(resp.getStatusCode() == HttpStatus.OK || resp.getStatusCode() == HttpStatus.UNAUTHORIZED,
                "/api/***REMOVED***/workspaces 期望 200/401，实际 " + resp.getStatusCode() + "（404 = 路由没注册）");
        assertTrue(resp.getStatusCode() != HttpStatus.NOT_FOUND, "/api/***REMOVED***/workspaces 是 404 ⇒ 装配没生效");

        // 测试类路径带 H2 ⇒ 内嵌 DataSource 成立 ⇒ 资源域装配生效，v1 路由必须注册并返回 ***REMOVED***Result 信封
        ResponseEntity<String> v1 = rest.getForEntity(
                "http://localhost:" + port() + "/api/***REMOVED***/v1/knowledgeBase/queryDetailById?***REMOVED***Id=x", String.class);
        System.out.println("READING-***REMOVED***WEB v1 with embedded H2 -> " + v1.getStatusCode() + " " + v1.getBody());
        assertEquals(HttpStatus.NOT_FOUND, v1.getStatusCode(), "v1 路由应已注册（未知 ***REMOVED***Id 走 404 信封）");
        assertTrue(v1.getBody() != null && v1.getBody().contains("\"success\""),
                "v1 路由应返回 ***REMOVED***Result 信封：" + v1.getBody());
    }

    @Test
    @DisplayName("排除 DataSourceAutoConfiguration 后资源域整块不装配：v1 路由不注册、启动不受影响")
    void v1RoutesRequireDataSource() {
        boot("spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration");
        TestRestTemplate rest = new TestRestTemplate();

        ResponseEntity<String> legacy = rest.getForEntity(
                "http://localhost:" + port() + "/api/***REMOVED***/workspaces", String.class);
        assertEquals(HttpStatus.OK, legacy.getStatusCode(), "既有 /api/***REMOVED***/* 不依赖 DataSource");

        ResponseEntity<String> v1 = rest.getForEntity(
                "http://localhost:" + port() + "/api/***REMOVED***/v1/knowledgeBase/queryDetailById?***REMOVED***Id=x", String.class);
        System.out.println("READING-***REMOVED***WEB v1 without DataSource -> " + v1.getStatusCode() + " " + v1.getBody());
        assertEquals(HttpStatus.NOT_FOUND, v1.getStatusCode(), "无 DataSource 时 v1 路由不该注册");
        assertTrue(v1.getBody() == null || !v1.getBody().contains("\"success\""),
                "v1 路由未注册时不该出现 ***REMOVED***Result 信封：" + v1.getBody());
    }

    @Test
    @DisplayName("7 个 controller 全部注册，handler 类名都在 com.zifang.z.***REMOVED***.web.controller 下")
    void ***REMOVED***ControllersAreRegistered() {
        boot();
        RequestMappingHandlerMapping mapping = ctx.getBean(RequestMappingHandlerMapping.class);

        List<String> ***REMOVED***Handlers = new ArrayList<>();
        List<String> paths = new ArrayList<>();
        java.util.Set<String> ***REMOVED***Types = new java.util.LinkedHashSet<>();
        mapping.getHandlerMethods().forEach((info, method) -> {
            String type = method.getBeanType().getName();
            if (type.startsWith("com.zifang.z.***REMOVED***.web.controller.")) {
                ***REMOVED***Types.add(type);
                ***REMOVED***Handlers.add(type);
                paths.addAll(patterns(info));
            }
        });

        System.out.println("READING-***REMOVED***WEB handler 类 = " + ***REMOVED***Types);
        System.out.println("READING-***REMOVED***WEB 路由 = " + paths);

        assertEquals(7, ***REMOVED***Types.size(), "z-***REMOVED*** controller 数不对：" + ***REMOVED***Types);
        for (String p : paths) {
            assertTrue(p.startsWith("/api/***REMOVED***/"), "出现非 /api/***REMOVED***/* 的路由：" + p);
        }
        assertEquals(7, new java.util.HashSet<>(***REMOVED***Types).size(), "controller bean 名有重复");
        // 每个 controller 的挂载根都要有真实路由（graph/ingest/modeling 没有裸根路由，
        // 只有 /{workspace}/... 这种子路径 —— 所以按前缀断言，不按裸根断言）
        String[][] expect = {
                {"WorkspaceController", "/api/***REMOVED***/workspaces"},
                {"DocumentController", "/api/***REMOVED***/documents"},
                {"SearchController", "/api/***REMOVED***/search"},
                {"ChatController", "/api/***REMOVED***/chat"},
                {"GraphController", "/api/***REMOVED***/graph"},
                {"IngestController", "/api/***REMOVED***/ingest"},
                {"ModelingController", "/api/***REMOVED***/modeling"},
        };
        for (String[] e : expect) {
            assertTrue(***REMOVED***Types.contains("com.zifang.z.***REMOVED***.web.controller." + e[0]),
                    "缺 controller：" + e[0] + "，实际：" + ***REMOVED***Types);
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
                "***REMOVED***.vector.storage-type=in-memory",
                "***REMOVED***.graph.engine=json",
                "***REMOVED***.graph.path=" + tempDir.resolve("graph").toString(),
                "***REMOVED***.storage.path=" + tempDir.resolve("***REMOVED***.json").toString()));
        props.addAll(List.of(extraProperties));
        SpringApplicationBuilder builder = new SpringApplicationBuilder(TestApp.class)
                .web(WebApplicationType.SERVLET)
                .properties(props.toArray(new String[0]));
        // 本机开发环境可能带着 SERVER__PORT=xxxx 这类环境变量（双下划线经宽松绑定
        // 恰好映射成 server.port）。SpringApplicationBuilder.properties() 落在
        // defaultProperties 里，优先级低于环境变量 —— 会被盖掉，Tomcat 就绑到了
        // 别的服务的端口上（实测：绑到宿主常驻服务代理，请求全被它抢答 401
        // AUTH_REQUIRED，classpath 里却搜不到这个错误码）。
        // 系统属性优先级高于环境变量，用它把 server.port 钉回 0。
        if (System.getProperty("server.port") == null) {
            System.setProperty("server.port", "0");
        }
        ctx = builder.run();
        // 启动后自检：绑定的端口必须真的属于本上下文 —— 若端口属性仍被外部
        // 覆盖（例如未来有人把系统属性也设了），直接失败给出明确原因，
        // 而不是让请求打到别的进程上得到莫名其妙的响应。
        String bound = ctx.getEnvironment().getProperty("local.server.port");
        String expected = System.getProperty("server.port");
        if ("0".equals(expected) && "0".equals(bound)) {
            ctx.close();
            throw new IllegalStateException("Tomcat 未完成端口绑定（local.server.port=0），"
                    + "检查是否被 SERVER_PORT / SERVER__PORT 环境变量干扰");
        }
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
