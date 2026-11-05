package com.zifang.z.kb.storage.resource;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.spring.MybatisSqlSessionFactoryBean;
import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;

import javax.sql.DataSource;

/**
 * z-kb 资源域持久化装配：注册 MyBatis-Plus Mapper 与建表器。
 *
 * <p>宿主没有 DataSource / MyBatis-Plus 时整块不生效，z-kb 其余能力不受影响。</p>
 *
 * <p><b>自持数据源与工厂（2026-11，主壳多数据源口径）</b>：z-opc 主壳容器里有
 * 18 个 SqlSessionFactory；本类裸 {@code @MapperScan} 不绑 {@code sqlSessionFactoryRef}
 * 时，MapperFactoryBean 按类型找唯一工厂 ⇒ 多候选无唯一匹配 ⇒ 启动即
 * NoUniqueBeanDefinitionException（materialMapper 首炸）。改为自持
 * {@code dataSourceKb} + {@code sqlSessionFactoryKb} 并显式绑定 ref：
 * 单数据源宿主（z-kb 自己的 H2 集成测试）行为不变，多数据源宿主不再歧义。</p>
 *
 * <p><b>nameGenerator（kb 前缀 bean 名）</b>：mapper bean 名原本是简单名首字母小写
 * （materialMapper / conceptMapper / wikiPageMapper …）。主壳 z-team 培训域有
 * {@code @Resource private TeamTrainingMaterialMapper materialMapper} ——
 * {@code @Resource} 按<b>字段名</b>优先查 bean，kb 的 {@code materialMapper}
 * 会被按名误命中 ⇒ 类型不匹配炸容器（第二个雷，工厂修完才暴露）。统一改为
 * {@code kbMaterialMapper} 这类前缀名：kb 内部消费全部走 @Bean 方法参数按类型
 * 解析，改名零副作用；跨宿主按名撞车面归零。</p>
 */
@AutoConfiguration(after = DataSourceAutoConfiguration.class)
@ConditionalOnClass({SqlSessionFactory.class, BaseMapper.class, DataSource.class})
@ConditionalOnBean(DataSource.class)
@ConditionalOnProperty(name = "kb.resource.persistence.enabled", havingValue = "true",
        matchIfMissing = true)
@MapperScan(basePackages = {"com.zifang.z.kb.storage.resource.mapper", "com.zifang.z.kb.storage.material.mapper",
        "com.zifang.z.kb.storage.compilation.mapper", "com.zifang.z.kb.storage.taskconfig.mapper",
        "com.zifang.z.kb.storage.extraction.mapper", "com.zifang.z.kb.storage.wiki.mapper",
        "com.zifang.z.kb.storage.evaluation.mapper"},
        sqlSessionFactoryRef = "sqlSessionFactoryKb",
        nameGenerator = KbBeanNameGenerator.class)
public class KbResourcePersistenceAutoConfiguration {

    /**
     * kb 域数据源：z.base.db.kb.*（平台多数据源口径）优先，
     * 缺省回退宿主主库 spring.datasource.*（单数据源宿主 / z-kb H2 集成测试）。
     *
     * <p>不直接注入宿主 DataSource（多候选歧义），也不与宿主共享池实例，
     * 池参数互不干扰。</p>
     */
    @Bean
    @ConditionalOnMissingBean(name = "dataSourceKb")
    public DataSource dataSourceKb(Environment env) {
        return KbDataSourceFactory.build(env);
    }

    /** kb 域工厂：绑 {@link #dataSourceKb}，mapper XML 走 BaseMapper 注解内建 SQL（本仓无 XML）。 */
    @Bean
    @ConditionalOnMissingBean(name = "sqlSessionFactoryKb")
    public SqlSessionFactory sqlSessionFactoryKb(
            @Qualifier("dataSourceKb") DataSource dataSourceKb) throws Exception {
        MybatisSqlSessionFactoryBean factoryBean = new MybatisSqlSessionFactoryBean();
        factoryBean.setDataSource(dataSourceKb);
        return factoryBean.getObject();
    }

    /**
     * 建表器：{@code kb.resource.auto-ddl}（默认开）只控制这一块——
     * 生产环境如需 DBA 统一管表可关闭，工厂与 mapper 不受影响。
     */
    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(name = "kb.resource.auto-ddl", havingValue = "true",
            matchIfMissing = true)
    public KbSchemaInitializer kbSchemaInitializer(
            @Qualifier("dataSourceKb") DataSource dataSourceKb) {
        return new KbSchemaInitializer(dataSourceKb);
    }
}
