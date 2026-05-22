package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;

@Schema(description = "All categories with latest signals for the requested timeframe")
public record CategoriesResponse(
    @Schema(description = "Date of the latest available data") LocalDate asOfDate,
    @Schema(description = "Requested timeframe", example = "MONTH") String timeframe,
    List<CategorySummaryDto> categories) {}
