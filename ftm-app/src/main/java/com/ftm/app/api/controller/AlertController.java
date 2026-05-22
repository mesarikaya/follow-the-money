package com.ftm.app.api.controller;

import com.ftm.app.api.dto.AlertDto;
import com.ftm.app.api.dto.AlertsResponse;
import com.ftm.app.api.service.AlertService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
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

  @PostMapping("/{alertId}/acknowledge")
  public ResponseEntity<AlertDto> acknowledgeAlert(@PathVariable Long alertId) {
    return ResponseEntity.ok(alertService.acknowledgeAlert(alertId));
  }
}
