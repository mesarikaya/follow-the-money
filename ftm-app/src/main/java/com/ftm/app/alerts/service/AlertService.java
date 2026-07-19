package com.ftm.app.alerts.service;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.api.dto.AlertDto;
import com.ftm.app.api.dto.AlertRuleDto;
import com.ftm.app.api.dto.AlertSeverityDayDto;
import com.ftm.app.api.dto.AlertsResponse;
import com.ftm.app.alerts.mapper.AlertMapper;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
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

  @Cacheable("alert-rules")
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

  @CacheEvict("alert-rules")
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

  public int countActiveAlertsNeedingAction() {
    return alertRepository.countActiveNeedingAction();
  }

  @Cacheable(value = "theme-alert-history", key = "#themeId.toUpperCase()")
  public List<AlertDto> getThemeAlertHistory(String themeId) {
    return alertRepository.findRecentByThemeId(themeId.toUpperCase(), RECENT_ALERTS_LIMIT).stream()
        .map(alertMapper::toDto)
        .toList();
  }

  public Map<String, Integer> getActiveAlertCountsByCategory() {
    return alertRepository.findActiveAlertCountsByCategory();
  }

  @Cacheable(value = "alert-rule-stats", key = "#days")
  public Map<String, Integer> getAlertRuleFireCounts(int days) {
    return alertRepository.findFireCountsByRuleSince(days);
  }

  @Cacheable(value = "alert-severity-history", key = "#days")
  public List<AlertSeverityDayDto> getAlertSeverityHistory(int days) {
    List<Map<String, Object>> rows = alertRepository.findDailySeverityCountsSince(days);
    Map<LocalDate, int[]> byDate = new LinkedHashMap<>();
    for (Map<String, Object> row : rows) {
      LocalDate date = (LocalDate) row.get("date");
      String severity = (String) row.get("severity");
      int count = (Integer) row.get("count");
      byDate.computeIfAbsent(date, d -> new int[4]);
      int[] counts = byDate.get(date);
      switch (severity) {
        case "URGENT" -> counts[0] += count;
        case "ACTION" -> counts[1] += count;
        case "WARNING" -> counts[2] += count;
        case "INFO" -> counts[3] += count;
        default -> {} // unknown severity — ignore
      }
    }
    List<AlertSeverityDayDto> result = new ArrayList<>(byDate.size());
    for (Map.Entry<LocalDate, int[]> entry : byDate.entrySet()) {
      int[] c = entry.getValue();
      result.add(new AlertSeverityDayDto(entry.getKey(), c[0], c[1], c[2], c[3]));
    }
    return result;
  }

  @Cacheable("recent-alerts")
  public List<AlertDto> getRecentAlerts() {
    return alertRepository.findRecentAlerts(EVENTS_FEED_LIMIT).stream()
        .map(alertMapper::toDto)
        .toList();
  }

  @Caching(
      evict = {
        @CacheEvict("alerts-latest"),
        @CacheEvict("alerts-count"),
        @CacheEvict("recent-alerts")
      })
  public int acknowledgeAllActive() {
    int count = alertRepository.acknowledgeAllActive();
    log.info("Bulk-dismissed {} active alerts", count);
    return count;
  }

  @Caching(
      evict = {
        @CacheEvict("alerts-latest"),
        @CacheEvict("alerts-count"),
        @CacheEvict("recent-alerts")
      })
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
