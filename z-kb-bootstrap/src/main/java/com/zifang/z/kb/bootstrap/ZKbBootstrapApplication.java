package com.zifang.z.***REMOVED***.bootstrap;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

/**
 * z-***REMOVED*** 启动器 — Spring Boot 入口，默认端口 8889。
 */
@SpringBootApplication
@ComponentScan(basePackages = {
        "com.zifang.z.***REMOVED***",
        "com.zifang.z.***REMOVED***.bootstrap"
})
public class Z***REMOVED***Application {

    public static void main(String[] args) {
        System.setProperty("spring.devtools.restart.enabled", "false");
        SpringApplication.run(Z***REMOVED***Application.class, args);
    }
}
