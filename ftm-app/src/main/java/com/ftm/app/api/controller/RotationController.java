package com.ftm.app.api.controller;

import com.ftm.app.api.dto.RotationResponse;
import com.ftm.app.signals.service.RotationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Rotation", description = "Sector rotation leaders, laggards, and detected events")
public class RotationController {

  private final RotationService rotationService;

  public RotationController(RotationService rotationService) {
    this.rotationService = rotationService;
  }

  @GetMapping("/rotation")
  @Operation(
      summary = "Top rotation leaders and laggards with recent rotation events (last 90 days)")
  public RotationResponse getLatest() {
    return rotationService.getLatest();
  }
}
