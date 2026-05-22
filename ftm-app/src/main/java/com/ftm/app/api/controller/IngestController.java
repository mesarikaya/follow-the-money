package com.ftm.app.api.controller;

import com.ftm.app.api.dto.IngestStatusResponse;
import com.ftm.app.api.dto.IngestTriggerResponse;
import com.ftm.app.ingestion.service.IngestTriggerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/ingest")
@Tag(name = "Ingestion", description = "Trigger and monitor data ingestion runs")
public class IngestController {

  private final IngestTriggerService ingestTriggerService;

  public IngestController(IngestTriggerService ingestTriggerService) {
    this.ingestTriggerService = ingestTriggerService;
  }

  @PostMapping("/trigger")
  @Operation(
      summary = "Trigger a manual ingestion run for all sources; returns run_ids for polling")
  public ResponseEntity<IngestTriggerResponse> trigger() {
    return ResponseEntity.accepted().body(ingestTriggerService.trigger());
  }

  @GetMapping("/status/{runId}")
  @Operation(summary = "Poll status of a specific ingestion run")
  public ResponseEntity<IngestStatusResponse> getStatus(@PathVariable UUID runId) {
    return ResponseEntity.ok(ingestTriggerService.getStatus(runId));
  }

  @GetMapping("/status/latest")
  @Operation(summary = "Latest run per source (PRICES, MACRO, FLOWS)")
  public ResponseEntity<List<IngestStatusResponse>> getLatest() {
    return ResponseEntity.ok(ingestTriggerService.getLatestPerSource());
  }
}
