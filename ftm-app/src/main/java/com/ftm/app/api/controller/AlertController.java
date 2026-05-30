package com.ftm.app.api.controller;

import com.ftm.app.api.dto.AlertDto;
import com.ftm.app.api.dto.AlertRuleDto;
import com.ftm.app.api.dto.AlertsResponse;
import com.ftm.app.api.service.AlertService;
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
public class AlertController {

  private final AlertService alertService;

  public AlertController(AlertService alertService) {
    this.alertService = alertService;
  }

  @GetMapping
  public AlertsResponse getAlerts() {
    return alertService.getAlerts();
  }

  @GetMapping("/rules")
  public List<AlertRuleDto> getAlertRules() {
    return alertService.getAlertRules();
  }

  @PutMapping("/rules/{ruleId}/enabled")
  public ResponseEntity<AlertRuleDto> setRuleEnabled(
      @PathVariable String ruleId, @RequestParam boolean enabled) {
    return ResponseEntity.ok(alertService.setRuleEnabled(ruleId, enabled));
  }

  @PostMapping("/{alertId}/acknowledge")
  public ResponseEntity<AlertDto> acknowledgeAlert(@PathVariable Long alertId) {
    return ResponseEntity.ok(alertService.acknowledgeAlert(alertId));
  }

  @PostMapping("/bulk-dismiss")
  public ResponseEntity<Map<String, Integer>> bulkDismiss() {
    int dismissed = alertService.acknowledgeAllActive();
    return ResponseEntity.ok(Map.of("dismissed", dismissed));
  }
}
