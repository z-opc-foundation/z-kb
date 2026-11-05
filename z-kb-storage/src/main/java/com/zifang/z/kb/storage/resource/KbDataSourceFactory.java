package com.zifang.z.kb.storage.resource;

import org.springframework.core.env.Environment;

import javax.sql.DataSource;

/**
 * kb 数据源构建：配置读取三级 fallback，直接用 Spring {@link Environment}
 * （不引 druid / 平台 starter，z-kb-storage 的依赖面保持自足）。
 *
 * <p><b>优先级</b>：</p>
 * <ol>
 *     <li>{@code z.base.db.kb.*} —— 平台多数据源口径（z-opc 主壳）</li>
 *     <li>{@code spring.datasource.*} —— 宿主主库（z-kb H2 集成测试、单数据源老宿主）</li>
 *     <li>内存兜底 {@code jdbc:h2:mem:kb-embedded;MODE=MySQL;DB_CLOSE_DELAY=-1} ——
 *     连宿主都没配 DataSource 属性时的安全网（能力不因无配置而失效，
 *     H2 在 classpath 时可用；主壳因 @ConditionalOnBean(DataSource) 已有真库不会走到这）</li>
 * </ol>
 *
 * <p>连接池：宿主 classpath 有 HikariCP（spring-boot-starter-jdbc 自带）就用 Hikari，
 * 否则退化为 {@code DriverManagerDataSource}（仅测试/极端自足场景，无池化）。</p>
 */
public final class KbDataSourceFactory {

    private static final String KB_PREFIX = "z.base.db.kb";
    private static final String HOST_PREFIX = "spring.datasource";

    private KbDataSourceFactory() {
    }

    /** 按三级 fallback 构建数据源。 */
    public static DataSource build(Environment env) {
        String url = first(env, KB_PREFIX + ".url", HOST_PREFIX + ".url");
        String username = first(env, KB_PREFIX + ".username", HOST_PREFIX + ".username", "sa");
        String password = first(env, KB_PREFIX + ".password", HOST_PREFIX + ".password", "");
        String driver = first(env, KB_PREFIX + ".driver-class-name", HOST_PREFIX + ".driver-class-name");
        if (url == null || url.isBlank()) {
            // 三级兜底：内存 H2（MODE=MySQL 贴近生产方言；无文件持久化，仅保能力可用）
            url = "jdbc:h2:mem:kb-embedded;MODE=MySQL;DB_CLOSE_DELAY=-1";
            username = "sa";
            password = "";
            driver = "org.h2.Driver";
        }
        if (driver == null || driver.isBlank()) {
            driver = url.startsWith("jdbc:h2") ? "org.h2.Driver" : "com.mysql.cj.jdbc.Driver";
        }
        return tryHikari(url, username, password, driver);
    }

    private static DataSource tryHikari(String url, String username, String password, String driver) {
        try {
            Class<?> hikariClass = Class.forName("com.zaxxer.hikari.HikariDataSource");
            Object ds = hikariClass.getDeclaredConstructor().newInstance();
            invoke(hikariClass, ds, "setJdbcUrl", url);
            invoke(hikariClass, ds, "setUsername", username);
            invoke(hikariClass, ds, "setPassword", password);
            invoke(hikariClass, ds, "setDriverClassName", driver);
            // 最小池参数：kb 不是重负载域，2~8 足够；连接建不起来快速失败（3s）
            invokeInt(hikariClass, ds, "setMinimumIdle", 2);
            invokeInt(hikariClass, ds, "setMaximumPoolSize", 8);
            invokeLong(hikariClass, ds, "setConnectionTimeout", 3000L);
            return (DataSource) ds;
        } catch (Throwable notOnClasspath) {
            org.springframework.jdbc.datasource.SimpleDriverDataSource simple =
                    new org.springframework.jdbc.datasource.SimpleDriverDataSource();
            try {
                simple.setDriverClass((Class<? extends java.sql.Driver>) Class.forName(driver));
            } catch (ClassNotFoundException e) {
                throw new IllegalStateException("z-kb 数据源驱动不可用: " + driver, e);
            }
            simple.setUrl(url);
            simple.setUsername(username);
            simple.setPassword(password);
            return simple;
        }
    }

    /** 依序取第一个「配置了且非空」的键。 */
    private static String first(Environment env, String... keys) {
        for (String key : keys) {
            String value = env.getProperty(key);
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private static void invoke(Class<?> type, Object target, String method, String value) throws Exception {
        type.getMethod(method, String.class).invoke(target, value);
    }

    private static void invokeInt(Class<?> type, Object target, String method, int value) throws Exception {
        type.getMethod(method, int.class).invoke(target, value);
    }

    private static void invokeLong(Class<?> type, Object target, String method, long value) throws Exception {
        type.getMethod(method, long.class).invoke(target, value);
    }
}
