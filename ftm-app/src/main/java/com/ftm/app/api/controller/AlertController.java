package com.ftm.app.api.controller;

import com.ftm.app.api.dto.AlertDto;
import com.ftm.app.api.dto.AlertRuleDto;
import com.ftm.app.api.dto.AlertSeverityDayDto;
import com.ftm.app.api.dto.AlertsResponse;
import com.ftm.app.alerts.service.AlertService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/alerts")
@Tag(name = "Alerts", description = "Signal-driven alerts and rule configuration")
public class AlertController {

  private final AlertService alertService;

  public AlertController(AlertService alertService) {
    this.alertService = alertService;
  }

  @GetMapping
  @Operation(summary = "Latest alerts with active count")
  public AlertsResponse getAlerts() {
    return alertService.getAlerts();
  }

  @GetMapping("/rules")
  @Operation(summary = "All alert rules with current enabled state")
  public List<AlertRuleDto> getAlertRules() {
    return alertService.getAlertRules();
  }

  @PutMapping("/rules/{ruleId}/enabled")
  @Operation(summary = "Enable or disable an alert rule")
  public ResponseEntity<AlertRuleDto> setRuleEnabled(
      @PathVariable String ruleId, @RequestParam boolean enabled) {
    return ResponseEntity.ok(alertService.setRuleEnabled(ruleId, enabled));
  }

  @PostMapping("/{alertId}/acknowledge")
  @Operation(summary = "Acknowledge a single alert by ID")
  public ResponseEntity<AlertDto> acknowledgeAlert(@PathVariable Long alertId) {
    return ResponseEntity.ok(alertService.acknowledgeAlert(alertId));
  }

  @GetMapping("/active/count")
  @Operation(summary = "Count of currently active (unacknowledged) alerts")
  public Map<String, Integer> getActiveCount() {
    return Map.of("active", alertService.countActiveAlerts());
  }

  @PostMapping("/bulk-dismiss")
  @Operation(summary = "Acknowledge all currently active alerts")
  public ResponseEntity<Map<String, Integer>> bulkDismiss() {
    int dismissed = alertService.acknowledgeAllActive();
    return ResponseEntity.ok(Map.of("dismissed", dismissed));
  }

  @GetMapping("/theme/{themeId}")
  @Operation(summary = "Alert history for a theme (all statuses, most recent first, limit 100)")
  public List<AlertDto> getThemeAlertHistory(@PathVariable String themeId) {
    return alertService.getThemeAlertHistory(themeId);
  }

  @GetMapping("/recent")
  @Operation(
      summary =
          "Recent alert events across all categories and themes (all statuses, most recent first, limit 30)")
  public List<AlertDto> getRecentAlerts() {
    return alertService.getRecentAlerts();
  }

  @GetMapping("/rule-stats")
  @Operation(summary = "Alert fire counts per rule over the last N days (default 30)")
  public Map<String, Integer> getRuleStats(@RequestParam(defaultValue = "30") int days) {
    return alertService.getAlertRuleFireCounts(days);
  }

  @GetMapping("/severity-history")
  @Operation(summary = "Daily alert fire counts by severity for the last N days (default 30)")
  public List<AlertSeverityDayDto> getSeverityHistory(@RequestParam(defaultValue = "30") int days) {
    return alertService.getAlertSeverityHistory(days);
  }
}
