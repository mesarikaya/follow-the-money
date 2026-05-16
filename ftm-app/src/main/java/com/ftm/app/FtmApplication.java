package com.ftm.app;

import com.ftm.app.config.FtmProperties;
import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.retry.annotation.EnableRetry;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableAsync
@EnableCaching
@EnableScheduling
@EnableRetry
@EnableConfigurationProperties(FtmProperties.class)
public class FtmApplication {

    public static void main(String[] args) {
        Dotenv.configure().ignoreIfMissing().load()
                .entries()
                .forEach(e -> {
                    if (System.getenv(e.getKey()) == null) {
                        System.setProperty(e.getKey(), e.getValue());
                    }
                });
        SpringApplication.run(FtmApplication.class, args);
    }
}
