package com.ftm.app.api.controller;

import com.ftm.app.api.dto.CategoriesResponse;
import com.ftm.app.api.dto.PriceLevelDto;
import com.ftm.app.api.dto.ScoreDecompositionDto;
import com.ftm.app.api.dto.ScreenerSnapshotDto;
import com.ftm.app.api.dto.SeasonalReturnDto;
import com.ftm.app.api.dto.SignalTransitionDto;
import com.ftm.app.api.dto.SignalWinRateDto;
import com.ftm.app.category.service.CategoryService;
import com.ftm.app.signals.service.ScoreDecompositionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/categories")
@Validated
@Tag(name = "Categories", description = "Investable category list with latest rotation signals")
public class CategoryController {

  private final CategoryService categoryService;
  private final ScoreDecompositionService scoreDecompositionService;

  public CategoryController(
      CategoryService categoryService, ScoreDecompositionService scoreDecompositionService) {
    this.categoryService = categoryService;
    this.scoreDecompositionService = scoreDecompositionService;
  }

  @GetMapping
  @Operation(summary = "All 19 categories with latest composite score and RRG quadrant")
  public ResponseEntity<CategoriesResponse> getCategories(
      @RequestParam(defaultValue = "MONTH")
          @Pattern(
              regexp = "DAY|WEEK|MONTH|QUARTER|YEAR",
              message = "timeframe must be one of DAY, WEEK, MONTH, QUARTER, YEAR")
          String timeframe) {
    return ResponseEntity.ok(categoryService.getCategoriesResponse(timeframe));
  }

  @GetMapping("/score-history")
  @Operation(
      summary = "Composite score history for all categories",
      description =
          "Returns the last N trading days of COMPOSITE scores per category, oldest first.")
  public ResponseEntity<Map<String, List<Double>>> getScoreHistory(
      @RequestParam(defaultValue = "30") @Min(5) @Max(120) int days) {
    return ResponseEntity.ok(categoryService.getCompositeScoreHistory(days));
  }

  @GetMapping("/price-levels")
  @Operation(
      summary = "52-week price range context for all categories",
      description =
          "Returns the 52-week high/low, current price drawdown from peak, and position within the "
              + "annual range for each category with at least 30 trading days of price data.")
  public ResponseEntity<List<PriceLevelDto>> getPriceLevels() {
    return ResponseEntity.ok(categoryService.getPriceLevels());
  }

  @GetMapping("/win-rates")
  @Operation(
      summary = "Historical BUY signal win rates",
      description =
          "For each category with at least 2 BUY signal transitions in the lookback window, "
              + "returns the fraction of signals followed by a positive 30-day forward return "
              + "and the average return. Lookback is clamped to [90, 730] days.")
  public ResponseEntity<List<SignalWinRateDto>> getWinRates(
      @RequestParam(defaultValue = "365") @Min(90) @Max(730) int lookbackDays) {
    return ResponseEntity.ok(categoryService.getBuySignalWinRates(lookbackDays));
  }

  @GetMapping("/seasonal")
  @Operation(
      summary = "Average monthly returns by calendar month",
      description =
          "Returns historical average return for each category × month combination. "
              + "Requires at least 2 complete calendar months of data per bucket.")
  public ResponseEntity<List<SeasonalReturnDto>> getSeasonalReturns() {
    return ResponseEntity.ok(categoryService.getSeasonalReturns());
  }

  @GetMapping("/score-components")
  @Operation(
      summary = "Factor contributions to the composite score for all categories",
      description =
          "Returns the 7 weighted factor contributions (RS-60, RS-120, Persistence, Flow, "
              + "Momentum, MacroFit, RRG) that sum to the composite score for each category. "
              + "Contributions are scaled by the effective weight denominator so they sum to "
              + "totalScore even when some components are unavailable.")
  public ResponseEntity<Map<String, ScoreDecompositionDto>> getScoreComponents() {
    return ResponseEntity.ok(scoreDecompositionService.getAllScoreDecompositions());
  }

  @GetMapping("/transitions")
  @Operation(
      summary = "Recent signal transitions",
      description =
          "Returns categories whose derived trade signal changed between today and a comparison "
              + "date that is at least {days} calendar days in the past. Ordered by signal priority "
              + "(BUY → WATCH → REDUCE → HOLD). Lookback clamped to [1, 90] days.")
  public ResponseEntity<List<SignalTransitionDto>> getSignalTransitions(
      @RequestParam(defaultValue = "7") @Min(1) @Max(90) int days) {
    return ResponseEntity.ok(categoryService.getSignalTransitions(days));
  }

  @GetMapping("/screener-snapshot")
  @Operation(
      summary = "Market-level signal distribution snapshot",
      description =
          "Returns aggregated BUY/WATCH/HOLD/REDUCE counts, average composite score, "
              + "RS breadth (% outperforming benchmark), momentum breadth (% where RS-20 > RS-60), "
              + "and risk-on breadth (% in Leading/Improving RRG quadrant) across top-level categories.")
  public ResponseEntity<ScreenerSnapshotDto> getScreenerSnapshot() {
    return ResponseEntity.ok(categoryService.getScreenerSnapshot());
  }
}
