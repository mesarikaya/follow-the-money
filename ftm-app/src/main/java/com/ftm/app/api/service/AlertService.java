package com.ftm.app.api.service;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.api.dto.AlertDto;
import com.ftm.app.api.dto.AlertRuleDto;
import com.ftm.app.api.dto.AlertsResponse;
import com.ftm.app.api.mapper.AlertMapper;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;

@Service
public class AlertService {

  private static final Logger log = LoggerFactory.getLogger(AlertService.class);
  private static final int RECENT_ALERTS_LIMIT = 100;
  private static final int EVENTS_FEED_LIMIT = 30;

  private final AlertRepository alertRepository;
  private final AlertRulesRepository alertRulesRepository;
  private final AlertMapper alertMapper;

  public AlertService(
      AlertRepository alertRepository,
      AlertRulesRepository alertRulesRepository,
      AlertMapper alertMapper) {
    this.alertRepository = alertRepository;
    this.alertRulesRepository = alertRulesRepository;
    this.alertMapper = alertMapper;
  }

  @Cacheable("alerts-latest")
  public AlertsResponse getAlerts() {
    List<Alert> activeAlerts = alertRepository.findAllActive();
    List<AlertDto> alertDtos = activeAlerts.stream().map(alertMapper::toDto).toList();
    return new AlertsResponse(alertDtos.size(), alertDtos);
  }

  public List<AlertRuleDto> getAlertRules() {
    return alertRulesRepository.findAll().stream()
        .map(
            r ->
                new AlertRuleDto(
                    r.ruleId(),
                    r.enabled(),
                    r.severity().name(),
                    r.compositeThreshold(),
                    r.persistenceDays()))
        .toList();
  }

  public AlertRuleDto setRuleEnabled(String ruleId, boolean enabled) {
    AlertRule rule =
        alertRulesRepository
            .updateEnabled(ruleId, enabled)
            .orElseThrow(() -> new NoSuchElementException("Alert rule not found: " + ruleId));
    log.info("Alert rule '{}' set enabled={}", ruleId, enabled);
    return new AlertRuleDto(
        rule.ruleId(),
        rule.enabled(),
        rule.severity().name(),
        rule.compositeThreshold(),
        rule.persistenceDays());
  }

  @Cacheable("alerts-count")
  public int countActiveAlerts() {
    return alertRepository.countActive();
  }

  public List<AlertDto> getThemeAlertHistory(String themeId) {
    return alertRepository.findRecentByThemeId(themeId.toUpperCase(), RECENT_ALERTS_LIMIT).stream()
        .map(alertMapper::toDto)
        .toList();
  }

  public Map<String, Integer> getActiveAlertCountsByCategory() {
    return alertRepository.findActiveAlertCountsByCategory();
  }

  public List<AlertDto> getRecentAlerts() {
    return alertRepository.findRecentAlerts(EVENTS_FEED_LIMIT).stream()
        .map(alertMapper::toDto)
        .toList();
  }

  @Caching(evict = {@CacheEvict("alerts-latest"), @CacheEvict("alerts-count")})
  public int acknowledgeAllActive() {
    int count = alertRepository.acknowledgeAllActive();
    log.info("Bulk-dismissed {} active alerts", count);
    return count;
  }

  @Caching(evict = {@CacheEvict("alerts-latest"), @CacheEvict("alerts-count")})
  public AlertDto acknowledgeAlert(Long alertId) {
    Alert acknowledged =
        alertRepository
            .acknowledgeAlert(alertId)
            .orElseThrow(
                () ->
                    new NoSuchElementException(
                        "Alert not found or already acknowledged: " + alertId));
    log.info("Alert acknowledged: id={}", alertId);
    return alertMapper.toDto(acknowledged);
  }
}
