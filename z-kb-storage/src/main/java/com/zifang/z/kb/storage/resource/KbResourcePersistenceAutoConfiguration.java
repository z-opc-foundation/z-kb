package com.zifang.z.kb.storage.resource;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.context.annotation.Bean;

import javax.sql.DataSource;

/**
 * z-kb 资源域持久化装配：注册 MyBatis-Plus Mapper 与建表器。
 *
 * <p>宿主没有 DataSource / MyBatis-Plus 时整块不生效，z-kb 其余能力不受影响。</p>
 */
@AutoConfiguration(after = DataSourceAutoConfiguration.class)
@ConditionalOnClass({SqlSessionFactory.class, BaseMapper.class, DataSource.class})
@ConditionalOnBean(DataSource.class)
@ConditionalOnProperty(name = "zkb.resource.persistence.enabled", havingValue = "true",
        matchIfMissing = true)
@MapperScan({"com.zifang.z.kb.storage.resource.mapper", "com.zifang.z.kb.storage.material.mapper",
        "com.zifang.z.kb.storage.compilation.mapper", "com.zifang.z.kb.storage.taskconfig.mapper",
        "com.zifang.z.kb.storage.extraction.mapper", "com.zifang.z.kb.storage.wiki.mapper",
        "com.zifang.z.kb.storage.evaluation.mapper"})
public class KbResourcePersistenceAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(name = "zkb.resource.auto-ddl", havingValue = "true",
            matchIfMissing = true)
    public KbSchemaInitializer kbSchemaInitializer(DataSource dataSource) {
        return new KbSchemaInitializer(dataSource);
    }
}
