package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(description = "Ingestion run status")
public record IngestStatusResponse(
        @Schema(description = "Unique run identifier") UUID runId,
        @Schema(description = "Data source", example = "prices") String source,
        @Schema(description = "Run status", example = "success") String status,
        @Schema(description = "When the run started") OffsetDateTime startedAt,
        @Schema(description = "When the run finished; null if still running") OffsetDateTime finishedAt,
        @Schema(description = "Number of rows inserted") Integer rowsInserted
) {}
