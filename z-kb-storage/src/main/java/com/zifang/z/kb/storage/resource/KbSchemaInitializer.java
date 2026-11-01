package com.zifang.z.kb.storage.resource;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * 启动时建表：按数据库产品选择 H2 / MySQL 脚本，脚本本身幂等。
 *
 * <p>由 {@code kb.resource.auto-ddl=true}（默认）开启；生产环境如需 DBA 统一管表可关闭。</p>
 *
 * <p><b>列迁移（TASK-20261101-006）</b>：{@code CREATE TABLE IF NOT EXISTS} 对**已存在的表**
 * 不会补列，所以新列必须走一段独立的「列存在才加」迁移。判据是 JDBC 元数据读
 * {@code INFORMATION_SCHEMA}，而不是「先查再改」的两段式（那是 TOCTOU，且不同方言
 * 的 information_schema 名字不一样）。</p>
 */
public class KbSchemaInitializer implements InitializingBean {

    private static final String[] SCRIPTS = {"resource-kb.sql", "material-kb.sql",
            "compilation-kb.sql", "taskconfig-kb.sql", "extraction-kb.sql", "wiki-kb.sql",
            "evaluation-kb.sql"};

    /** 待补列：表名 → 列名 → 列定义（按方言给不同类型）。 */
    private static final String[][] COLUMNS = {
            {"kb_concept", "cognition_key", "VARCHAR(128) NULL"},
            {"kb_graph_node", "labels", "VARCHAR(512) NULL"},
    };

    private final DataSource dataSource;

    public KbSchemaInitializer(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void afterPropertiesSet() {
        String product;
        try (Connection connection = dataSource.getConnection()) {
            product = connection.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT);
        } catch (SQLException e) {
            throw new IllegalStateException("z-kb 元数据建表失败：无法连接数据库", e);
        }
        String dialect = product.contains("h2") ? "h2" : "mysql";
        for (String script : SCRIPTS) {
            ResourceDatabasePopulator populator = new ResourceDatabasePopulator(
                    new ClassPathResource("db/" + dialect + "/" + script));
            populator.setSqlScriptEncoding("UTF-8");
            populator.execute(dataSource);
        }
        migrateColumns(dialect);
    }

    /**
     * 幂等补列：列已存在则跳过，缺失则 ALTER TABLE ADD COLUMN。
     *
     * <p>列存在性走 {@link DatabaseMetaData#getColumns}：H2 与 MySQL 都支持，且不依赖
     * 方言特有的 information_schema 视图。</p>
     */
    private void migrateColumns(String dialect) {
        try (Connection connection = dataSource.getConnection()) {
            for (String[] spec : COLUMNS) {
                String table = spec[0];
                String column = spec[1];
                if (columnExists(connection, table, column)) {
                    continue;
                }
                String type = spec[2];
                if ("mysql".equals(dialect)) {
                    // MySQL 的 VARCHAR 需要长度且 COMMENT 属 MySQL 专有语法
                    type = type.replace("VARCHAR(128) NULL", "VARCHAR(128) NULL COMMENT '公司级认知键（z-cognition 的 conceptKey/termKey）；可空=未消歧，跨库归一依据'");
                    type = type.replace("VARCHAR(512) NULL", "VARCHAR(512) NULL COMMENT '节点标签，逗号分隔；Cog:{key} 表示已挂上公司级认知真源'");
                }
                String sql = "ALTER TABLE " + table + " ADD COLUMN " + column + " " + type;
                try (Statement statement = connection.createStatement()) {
                    statement.execute(sql);
                }
            }
        } catch (SQLException e) {
            throw new IllegalStateException("z-kb 元数据列迁移失败", e);
        }
    }

    /** 判断列是否已存在（表名/列名大小写不敏感，按各产品惯例补两种写法）。 */
    private boolean columnExists(Connection connection, String table, String column)
            throws SQLException {
        DatabaseMetaData meta = connection.getMetaData();
        List<String> tables = Arrays.asList(table.toUpperCase(Locale.ROOT), table.toLowerCase(Locale.ROOT));
        List<String> columns = Arrays.asList(column.toUpperCase(Locale.ROOT), column.toLowerCase(Locale.ROOT));
        for (String t : tables) {
            try (ResultSet rs = meta.getColumns(null, null, t, null)) {
                while (rs.next()) {
                    String name = rs.getString("COLUMN_NAME");
                    if (name == null) {
                        continue;
                    }
                    for (String c : columns) {
                        if (c.equals(name.toUpperCase(Locale.ROOT))) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }
}
