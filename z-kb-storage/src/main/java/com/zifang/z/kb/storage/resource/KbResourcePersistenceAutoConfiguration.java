package com.zifang.z.***REMOVED***.storage.resource;

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
 * z-***REMOVED*** 资源域持久化装配：注册 MyBatis-Plus Mapper 与建表器。
 *
 * <p>宿主没有 DataSource / MyBatis-Plus 时整块不生效，z-***REMOVED*** 其余能力不受影响。</p>
 */
@AutoConfiguration(after = DataSourceAutoConfiguration.class)
@ConditionalOnClass({SqlSessionFactory.class, BaseMapper.class, DataSource.class})
@ConditionalOnBean(DataSource.class)
@ConditionalOnProperty(name = "z***REMOVED***.resource.persistence.enabled", havingValue = "true",
        matchIfMissing = true)
@MapperScan({"com.zifang.z.***REMOVED***.storage.resource.mapper", "com.zifang.z.***REMOVED***.storage.material.mapper",
        "com.zifang.z.***REMOVED***.storage.compilation.mapper", "com.zifang.z.***REMOVED***.storage.taskconfig.mapper",
        "com.zifang.z.***REMOVED***.storage.extraction.mapper", "com.zifang.z.***REMOVED***.storage.wiki.mapper",
        "com.zifang.z.***REMOVED***.storage.evaluation.mapper"})
public class ***REMOVED***ResourcePersistenceAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(name = "z***REMOVED***.resource.auto-ddl", havingValue = "true",
            matchIfMissing = true)
    public ***REMOVED***SchemaInitializer ***REMOVED***SchemaInitializer(DataSource dataSource) {
        return new ***REMOVED***SchemaInitializer(dataSource);
    }
}
