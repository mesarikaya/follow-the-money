package com.ftm.app.api.service;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.api.dto.AlertDto;
import com.ftm.app.api.dto.AlertsResponse;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.NoSuchElementException;

@Service
public class AlertService {

    private static final Logger log = LoggerFactory.getLogger(AlertService.class);
    private static final int RECENT_ALERTS_LIMIT = 100;

    private final AlertRepository alertRepository;

    public AlertService(AlertRepository alertRepository) {
        this.alertRepository = alertRepository;
    }

    public AlertsResponse getAlerts() {
        List<Alert> recentAlerts = alertRepository.findRecentAlerts(RECENT_ALERTS_LIMIT);
        long activeCount = recentAlerts.stream()
                .filter(a -> a.status() == AlertStatus.ACTIVE)
                .count();
        List<AlertDto> alertDtos = recentAlerts.stream()
                .map(this::toDto)
                .toList();
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
                .map(this::toDto)
                .findFirst()
                .orElseThrow();
    }

    private AlertDto toDto(Alert alert) {
        return new AlertDto(
                alert.id(),
                alert.createdAt(),
                alert.categoryId() != null ? alert.categoryId().name() : null,
                alert.ruleId(),
                alert.severity().name(),
                alert.message(),
                alert.status().name(),
                alert.resolvedAt(),
                alert.acknowledgedAt());
    }
}
