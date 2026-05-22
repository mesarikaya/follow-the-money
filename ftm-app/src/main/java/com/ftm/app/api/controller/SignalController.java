package com.ftm.app.api.controller;

import com.ftm.app.api.dto.SignalHistoryDto;
import com.ftm.app.api.mapper.SignalHistoryMapper;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.signals.service.SignalComputationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Signals", description = "Signal history per category")
public class SignalController {

  private final SignalRepository signalRepository;
  private final SignalHistoryMapper signalHistoryMapper;
  private final SignalComputationService signalComputationService;

  public SignalController(
      SignalRepository signalRepository,
      SignalHistoryMapper signalHistoryMapper,
      SignalComputationService signalComputationService) {
    this.signalRepository = signalRepository;
    this.signalHistoryMapper = signalHistoryMapper;
    this.signalComputationService = signalComputationService;
  }

  @GetMapping("/signals/{categoryId}")
  @Operation(summary = "Full signal history for a category")
  public List<SignalHistoryDto> getSignalHistory(@PathVariable String categoryId) {
    return signalRepository.findByCategoryId(categoryId.toUpperCase()).stream()
        .map(signalHistoryMapper::toDto)
        .toList();
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
