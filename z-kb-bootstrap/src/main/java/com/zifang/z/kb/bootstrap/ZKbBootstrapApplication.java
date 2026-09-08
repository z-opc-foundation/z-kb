package com.zifang.z.kb.bootstrap;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

/**
 * z-kb 启动器 — Spring Boot 入口，默认端口 8889。
 */
@SpringBootApplication
@ComponentScan(basePackages = {
        "com.zifang.z.kb",
        "com.zifang.z.kb.bootstrap"
})
public class ZKbBootstrapApplication {

    public static void main(String[] args) {
        System.setProperty("spring.devtools.restart.enabled", "false");
        SpringApplication.run(ZKbBootstrapApplication.class, args);
    }
}
