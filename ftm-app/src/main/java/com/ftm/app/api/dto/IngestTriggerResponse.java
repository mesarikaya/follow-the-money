package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.UUID;

@Schema(description = "Response to a manual ingestion trigger")
public record IngestTriggerResponse(
    @Schema(description = "Run identifiers per source (PRICES, MACRO, FLOWS)") List<UUID> runIds,
    @Schema(description = "Initial status", example = "queued") String status,
    @Schema(description = "Human-readable message") String message) {}
