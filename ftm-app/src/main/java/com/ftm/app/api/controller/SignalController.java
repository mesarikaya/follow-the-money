package com.ftm.app.api.controller;

import com.ftm.app.api.dto.SignalHistoryDto;
import com.ftm.app.signals.service.SignalHistoryService;
import com.ftm.app.signals.service.SignalComputationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Signals", description = "Signal history per category")
@Validated
public class SignalController {

  private final SignalHistoryService signalHistoryService;
  private final SignalComputationService signalComputationService;

  public SignalController(
      SignalHistoryService signalHistoryService,
      SignalComputationService signalComputationService) {
    this.signalHistoryService = signalHistoryService;
    this.signalComputationService = signalComputationService;
  }

  @GetMapping("/signals/{categoryId}")
  @Operation(summary = "Signal history for a category, optionally limited to recent N days")
  public List<SignalHistoryDto> getSignalHistory(
      @PathVariable String categoryId,
      @RequestParam(defaultValue = "0") @Min(0) @Max(3650) int days) {
    return signalHistoryService.getHistory(categoryId.toUpperCase(), days);
  }

  @PostMapping("/signals/compute")
  @Operation(
      summary = "Force signal computation for all categories",
      description =
          "Detects new categories without signals and backfills. "
              + "Also computes any missing dates since last run.")
  public ResponseEntity<Map<String, String>> forceCompute() {
    signalComputationService.computeAndStore();
    return ResponseEntity.ok(Map.of("status", "Signal computation completed"));
  }
}
