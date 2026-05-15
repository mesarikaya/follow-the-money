package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

@Schema(description = "Response to a manual ingestion trigger")
public record IngestTriggerResponse(
        @Schema(description = "Unique run identifier for polling status") UUID runId,
        @Schema(description = "Initial status", example = "QUEUED") String status,
        @Schema(description = "Human-readable message") String message
) {}
