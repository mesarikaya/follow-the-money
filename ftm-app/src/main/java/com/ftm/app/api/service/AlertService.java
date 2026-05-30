package com.ftm.app.api.service;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.api.dto.AlertDto;
import com.ftm.app.api.dto.AlertRuleDto;
import com.ftm.app.api.dto.AlertsResponse;
import com.ftm.app.api.mapper.AlertMapper;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.AlertStatus;
import java.util.List;
import java.util.NoSuchElementException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class AlertService {

  private static final Logger log = LoggerFactory.getLogger(AlertService.class);
  private static final int RECENT_ALERTS_LIMIT = 100;

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

  public AlertsResponse getAlerts() {
    List<Alert> recentAlerts = alertRepository.findRecentAlerts(RECENT_ALERTS_LIMIT);
    long activeCount = recentAlerts.stream().filter(a -> a.status() == AlertStatus.ACTIVE).count();
    List<AlertDto> alertDtos = recentAlerts.stream().map(alertMapper::toDto).toList();
    return new AlertsResponse((int) activeCount, alertDtos);
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
    boolean updated = alertRulesRepository.updateEnabled(ruleId, enabled);
    if (!updated) {
      throw new NoSuchElementException("Alert rule not found: " + ruleId);
    }
    log.info("Alert rule '{}' set enabled={}", ruleId, enabled);
    AlertRule rule =
        alertRulesRepository
            .findById(ruleId)
            .orElseThrow(
                () -> new NoSuchElementException("Alert rule not found after update: " + ruleId));
    return new AlertRuleDto(
        rule.ruleId(),
        rule.enabled(),
        rule.severity().name(),
        rule.compositeThreshold(),
        rule.persistenceDays());
  }

  public int acknowledgeAllActive() {
    int count = alertRepository.acknowledgeAllActive();
    log.info("Bulk-dismissed {} active alerts", count);
    return count;
  }

  public AlertDto acknowledgeAlert(Long alertId) {
    int rowsUpdated = alertRepository.acknowledgeAlert(alertId);
    if (rowsUpdated == 0) {
      throw new NoSuchElementException("Alert not found or already acknowledged: " + alertId);
    }
    log.info("Alert acknowledged: id={}", alertId);
    return alertRepository
        .findById(alertId)
        .map(alertMapper::toDto)
        .orElseThrow(
            () -> new NoSuchElementException("Alert not found after acknowledge: " + alertId));
  }
}
