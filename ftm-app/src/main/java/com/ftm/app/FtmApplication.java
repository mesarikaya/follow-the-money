package com.ftm.app;

import com.ftm.app.config.FtmProperties;
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

  static void main(String[] args) {
    SpringApplication.run(FtmApplication.class, args);
  }
}
