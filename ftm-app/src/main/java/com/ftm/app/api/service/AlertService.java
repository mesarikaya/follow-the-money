package com.ftm.app.api.service;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.api.dto.AlertDto;
import com.ftm.app.api.dto.AlertsResponse;
import com.ftm.app.api.mapper.AlertMapper;
import com.ftm.app.domain.Alert;
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
  private final AlertMapper alertMapper;

  public AlertService(AlertRepository alertRepository, AlertMapper alertMapper) {
    this.alertRepository = alertRepository;
    this.alertMapper = alertMapper;
  }

  public AlertsResponse getAlerts() {
    List<Alert> recentAlerts = alertRepository.findRecentAlerts(RECENT_ALERTS_LIMIT);
    long activeCount = recentAlerts.stream().filter(a -> a.status() == AlertStatus.ACTIVE).count();
    List<AlertDto> alertDtos = recentAlerts.stream().map(alertMapper::toDto).toList();
    return new AlertsResponse((int) activeCount, alertDtos);
  }

  public AlertDto acknowledgeAlert(Long alertId) {
    int rowsUpdated = alertRepository.acknowledgeAlert(alertId);
    if (rowsUpdated == 0) {
      throw new NoSuchElementException("Alert not found or already acknowledged: " + alertId);
    }
    log.info("Alert acknowledged: id={}", alertId);
    return alertRepository.findRecentAlerts(RECENT_ALERTS_LIMIT).stream()
        .filter(a -> a.id().equals(alertId))
        .map(alertMapper::toDto)
        .findFirst()
        .orElseThrow();
  }
}
