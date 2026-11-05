package com.zifang.z.kb.storage.resource;

import org.springframework.beans.factory.annotation.AnnotatedBeanDefinition;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.support.BeanDefinitionRegistry;
import org.springframework.core.type.AnnotationMetadata;
import org.springframework.util.ClassUtils;

import java.util.Map;

/**
 * kb mapper bean 名生成器：统一 {@code kb} 前缀（MaterialMapper → kbMaterialMapper）。
 *
 * <p><b>为什么不能让 mapper 落在默认名上</b>：默认名 = 简单名首字母小写（materialMapper），
 * 而主壳 z-team 培训域存在 {@code @Resource private TeamTrainingMaterialMapper materialMapper}
 * —— {@code @Resource}（CommonAnnotationBeanPostProcessor）按<b>字段名</b>优先查 bean，
 * 名字命中但类型不匹配 ⇒ 容器装配失败。前缀化后跨宿主按名撞车面归零；
 * kb 内部消费全部走 @Bean 方法参数按类型解析，改名零副作用。</p>
 *
 * <p>对带注解元数据的定义沿用注解 value 显式名（如果有），与 Spring
 * AnnotationBeanNameGenerator 的语义保持一致；普通 scanned 定义用 {@code kb + 简单名}。</p>
 */
public class KbBeanNameGenerator implements org.springframework.beans.factory.support.BeanNameGenerator {

    @Override
    public String generateBeanName(BeanDefinition definition, BeanDefinitionRegistry registry) {
        if (definition instanceof AnnotatedBeanDefinition annotated) {
            AnnotationMetadata metadata = annotated.getMetadata();
            // 注意：无 @Component 注解的接口这里返回 null，不能直接链式 .get()
            Map<String, Object> attrs = metadata.getAnnotationAttributes(
                    "org.springframework.stereotype.Component");
            String explicit = attrs == null ? null : (String) attrs.get("value");
            if (explicit != null && !explicit.isBlank()) {
                return explicit;
            }
        }
        String className = definition.getBeanClassName();
        if (className == null) {
            // ClassPathMapperScanner 的 scanned 定义必有 className；防御性兜底
            return "kbUnknownMapper";
        }
        return "kb" + ClassUtils.getShortName(className);
    }
}
