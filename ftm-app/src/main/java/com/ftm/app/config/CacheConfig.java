package com.ftm.app.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager();
        // Evicted on SignalsUpdatedEvent (EP-005)
        manager.registerCustomCache("signals-latest",
                Caffeine.newBuilder().maximumSize(200).expireAfterWrite(1, TimeUnit.HOURS).build());
        manager.registerCustomCache("rotation-matrix",
                Caffeine.newBuilder().maximumSize(10).expireAfterWrite(1, TimeUnit.HOURS).build());
        // Evicted on SignalsUpdatedEvent (EP-006)
        manager.registerCustomCache("rrg-latest",
                Caffeine.newBuilder().maximumSize(10).expireAfterWrite(1, TimeUnit.HOURS).build());
        // Evicted on IngestionCompleteEvent (EP-001)
        manager.registerCustomCache("macro-latest",
                Caffeine.newBuilder().maximumSize(10).expireAfterWrite(6, TimeUnit.HOURS).build());
        return manager;
    }
}
