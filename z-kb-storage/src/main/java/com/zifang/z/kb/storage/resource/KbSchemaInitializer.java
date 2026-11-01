package com.zifang.z.***REMOVED***.storage.resource;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Locale;

/**
 * 启动时建表：按数据库产品选择 H2 / MySQL 脚本，脚本本身幂等。
 *
 * <p>由 {@code ***REMOVED***.resource.auto-ddl=true}（默认）开启；生产环境如需 DBA 统一管表可关闭。</p>
 */
public class ***REMOVED***SchemaInitializer implements InitializingBean {

    private static final String[] SCRIPTS = {"resource-***REMOVED***.sql", "material-***REMOVED***.sql",
            "compilation-***REMOVED***.sql", "taskconfig-***REMOVED***.sql", "extraction-***REMOVED***.sql", "wiki-***REMOVED***.sql",
            "evaluation-***REMOVED***.sql"};

    private final DataSource dataSource;

    public ***REMOVED***SchemaInitializer(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void afterPropertiesSet() {
        String product;
        try (Connection connection = dataSource.getConnection()) {
            product = connection.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT);
        } catch (SQLException e) {
            throw new IllegalStateException("z-***REMOVED*** 元数据建表失败：无法连接数据库", e);
        }
        String dialect = product.contains("h2") ? "h2" : "mysql";
        for (String script : SCRIPTS) {
            ResourceDatabasePopulator populator = new ResourceDatabasePopulator(
                    new ClassPathResource("db/" + dialect + "/" + script));
            populator.setSqlScriptEncoding("UTF-8");
            populator.execute(dataSource);
        }
    }
}
