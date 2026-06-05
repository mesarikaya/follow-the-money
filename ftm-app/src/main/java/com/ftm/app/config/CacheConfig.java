package com.ftm.app.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.concurrent.TimeUnit;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CacheConfig {

  @Bean
  public CacheManager cacheManager() {
    CaffeineCacheManager manager = new CaffeineCacheManager();
    // Evicted on SignalsUpdatedEvent (EP-005)
    manager.registerCustomCache(
        "signals-latest",
        Caffeine.newBuilder().maximumSize(200).expireAfterWrite(1, TimeUnit.HOURS).build());
    // Evicted on SignalsUpdatedEvent (EP-006)
    manager.registerCustomCache(
        "rrg-latest",
        Caffeine.newBuilder().maximumSize(10).expireAfterWrite(1, TimeUnit.HOURS).build());
    // Evicted on IngestionCompleteEvent (EP-001)
    manager.registerCustomCache(
        "macro-latest",
        Caffeine.newBuilder().maximumSize(10).expireAfterWrite(6, TimeUnit.HOURS).build());
    // Evicted on IngestionCompleteEvent (source=MACRO) — keyed by lookback days
    manager.registerCustomCache(
        "macro-history",
        Caffeine.newBuilder().maximumSize(20).expireAfterWrite(6, TimeUnit.HOURS).build());
    // Evicted on SignalsUpdatedEvent (EP-008)
    manager.registerCustomCache(
        "rotation-latest",
        Caffeine.newBuilder().maximumSize(10).expireAfterWrite(1, TimeUnit.HOURS).build());
    // Evicted on SignalsUpdatedEvent — keyed by parent category ID
    manager.registerCustomCache(
        "sub-sectors-latest",
        Caffeine.newBuilder().maximumSize(50).expireAfterWrite(1, TimeUnit.HOURS).build());
    // Evicted on SignalsUpdatedEvent — keyed by lookback days; avoids 4 DB queries per call
    manager.registerCustomCache(
        "transitions-latest",
        Caffeine.newBuilder().maximumSize(20).expireAfterWrite(1, TimeUnit.HOURS).build());
    // Evicted on SignalsUpdatedEvent — expensive PERCENT_RANK window function; no-arg (single entry)
    manager.registerCustomCache(
        "score-percentile-252d",
        Caffeine.newBuilder().maximumSize(1).expireAfterWrite(1, TimeUnit.HOURS).build());
    // Evicted on SignalsUpdatedEvent — window function over 365d of COMPOSITE signals; keyed by threshold
    manager.registerCustomCache(
        "signal-days-active",
        Caffeine.newBuilder().maximumSize(10).expireAfterWrite(1, TimeUnit.HOURS).build());
    // Evicted on SignalsUpdatedEvent — ROW_NUMBER CTE over 400d of raw_prices; no-arg (single entry)
    manager.registerCustomCache(
        "price-levels",
        Caffeine.newBuilder().maximumSize(1).expireAfterWrite(1, TimeUnit.HOURS).build());
    // Evicted on SignalsUpdatedEvent — LAG + LATERAL join win-rate query; keyed by lookbackDays
    manager.registerCustomCache(
        "win-rates",
        Caffeine.newBuilder().maximumSize(10).expireAfterWrite(1, TimeUnit.HOURS).build());
    // Evicted on SignalsUpdatedEvent — composite score history time series; keyed by days
    manager.registerCustomCache(
        "score-history",
        Caffeine.newBuilder().maximumSize(20).expireAfterWrite(1, TimeUnit.HOURS).build());
    // Evicted on SignalsUpdatedEvent — seasonal monthly averages; no-arg (single entry)
    manager.registerCustomCache(
        "seasonal-returns",
        Caffeine.newBuilder().maximumSize(1).expireAfterWrite(1, TimeUnit.HOURS).build());
    // Evicted on SignalsUpdatedEvent — keyed by categoryId+days; ~20 categories × a few day params
    manager.registerCustomCache(
        "signal-history",
        Caffeine.newBuilder().maximumSize(200).expireAfterWrite(1, TimeUnit.HOURS).build());
    // Evicted on SignalsUpdatedEvent (AlertRulesEngine fires after each computation) and on
    // user-triggered acknowledge operations via @CacheEvict in AlertService
    manager.registerCustomCache(
        "alerts-latest",
        Caffeine.newBuilder().maximumSize(1).expireAfterWrite(30, TimeUnit.MINUTES).build());
    manager.registerCustomCache(
        "alerts-count",
        Caffeine.newBuilder().maximumSize(1).expireAfterWrite(30, TimeUnit.MINUTES).build());
    // Not evicted by events — FX rates fetched from FRED/Yahoo on every upload; 1h TTL avoids
    // repeated external calls when multiple holdings share the same currency conversion step
    manager.registerCustomCache(
        "fx-rate-usd-per-eur",
        Caffeine.newBuilder().maximumSize(1).expireAfterWrite(1, TimeUnit.HOURS).build());
    manager.registerCustomCache(
        "fx-rate-gbp-usd",
        Caffeine.newBuilder().maximumSize(1).expireAfterWrite(1, TimeUnit.HOURS).build());
    return manager;
  }
}
