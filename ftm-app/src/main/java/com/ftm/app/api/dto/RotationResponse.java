package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.List;

@Schema(description = "Rotation leadership rankings and recent rotation events")
public record RotationResponse(
        @Schema(description = "Date of the latest signal data") LocalDate asOfDate,
        @Schema(description = "Top 3 categories by composite score (strongest inflows)") List<RotationLeaderEntry> topLeaders,
        @Schema(description = "Bottom 3 categories by composite score (weakest / outflows)") List<RotationLeaderEntry> bottomLaggards,
        @Schema(description = "Recent rotation events (last 90 days)") List<RotationEventEntry> recentEvents
) {}
