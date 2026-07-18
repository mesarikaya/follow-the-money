package com.ftm.app.api.controller;

import com.ftm.app.api.dto.CapitalRotationDto;
import com.ftm.app.api.dto.ThemeCorrelationDto;
import com.ftm.app.api.dto.ThemeDetailDto;
import com.ftm.app.api.dto.ThemeHistoryPointDto;
import com.ftm.app.api.dto.ThemePortfolioCoverageDto;
import com.ftm.app.api.dto.ThemeSnapshotDto;
import com.ftm.app.api.dto.ThemeSummaryDto;
import com.ftm.app.themes.service.ThemeService;
import com.ftm.app.themes.correlation.ThemeSignalCorrelationService;
import com.ftm.app.themes.coverage.ThemePortfolioCoverageService;
import com.ftm.app.themes.rotation.CapitalRotationResult;
import com.ftm.app.themes.rotation.CapitalRotationScoreService;
import com.ftm.app.themes.snapshot.ThemeSnapshotService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/themes")
@Validated
@Tag(
    name = "Themes",
    description = "Cross-sector investment theme baskets with aggregated rotation signals")
public class ThemeController {

  private final ThemeService themeService;
  private final CapitalRotationScoreService capitalRotationScoreService;
  private final ThemeSignalCorrelationService themeSignalCorrelationService;
  private final ThemeSnapshotService themeSnapshotService;
  private final ThemePortfolioCoverageService themePortfolioCoverageService;

  public ThemeController(
      ThemeService themeService,
      CapitalRotationScoreService capitalRotationScoreService,
      ThemeSignalCorrelationService themeSignalCorrelationService,
      ThemeSnapshotService themeSnapshotService,
      ThemePortfolioCoverageService themePortfolioCoverageService) {
    this.themeService = themeService;
    this.capitalRotationScoreService = capitalRotationScoreService;
    this.themeSignalCorrelationService = themeSignalCorrelationService;
    this.themeSnapshotService = themeSnapshotService;
    this.themePortfolioCoverageService = themePortfolioCoverageService;
  }

  @GetMapping
  @Operation(summary = "All investment themes with aggregated composite, RS, and flow signals")
  public List<ThemeSummaryDto> getThemes() {
    return themeService.getThemes();
  }

  @GetMapping("/{themeId}")
  @Operation(
      summary = "Detail view for a single theme: all constituent ETFs with individual signals")
  public ThemeDetailDto getTheme(
      @PathVariable
          @Pattern(
              regexp = "[A-Za-z0-9_]{1,30}",
              message = "themeId must be 1–30 alphanumeric characters")
          String themeId) {
    return themeService.getTheme(themeId.toUpperCase());
  }

  @GetMapping("/rotation-score")
  @Operation(
      summary =
          "Capital rotation intensity across all themes: score dispersion + trend alignment weighted composite")
  public CapitalRotationDto getRotationScore() {
    List<ThemeSummaryDto> themes = themeService.getThemes();
    CapitalRotationResult result = capitalRotationScoreService.compute(themes);
    return new CapitalRotationDto(
        result.rotationScore(),
        result.intensityLabel(),
        result.scoreDispersion(),
        result.trendAlignment(),
        result.leadingThemeNames(),
        result.laggingThemeNames());
  }

  @GetMapping("/{themeId}/history")
  @Operation(
      summary =
          "Daily composite score history for a theme — per-day average across all constituents, ordered earliest to latest")
  public List<ThemeHistoryPointDto> getThemeHistory(
      @PathVariable
          @Pattern(
              regexp = "[A-Za-z0-9_]{1,30}",
              message = "themeId must be 1–30 alphanumeric characters")
          String themeId,
      @RequestParam(defaultValue = "30") @Min(1) @Max(252) int days) {
    return themeService.getThemeHistory(themeId.toUpperCase(), days);
  }

  @GetMapping("/portfolio-coverage")
  @Operation(
      summary =
          "Portfolio theme coverage: which themes have portfolio exposure vs. uncovered gap opportunities")
  public List<ThemePortfolioCoverageDto> getPortfolioCoverage() {
    return themePortfolioCoverageService.getCoverage();
  }

  @GetMapping("/snapshot")
  @Operation(
      summary =
          "Market-level snapshot of all themes: signal distribution, phase breakdown, score average, and momentum balance")
  public ThemeSnapshotDto getSnapshot() {
    return themeSnapshotService.getSnapshot();
  }

  @GetMapping("/signal-correlation")
  @Operation(
      summary =
          "Pairwise Pearson correlation of daily score deltas across all themes — measures signal co-movement, not return correlation")
  public ThemeCorrelationDto getSignalCorrelation(
      @RequestParam(defaultValue = "60") @Min(20) @Max(252) int days) {
    return themeSignalCorrelationService.compute(days);
  }
}
