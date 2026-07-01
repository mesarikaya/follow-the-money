package com.ftm.app.themes.coverage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.data.Offset.offset;

import com.ftm.app.api.dto.HoldingDto;
import com.ftm.app.api.dto.ThemePortfolioCoverageDto;
import com.ftm.app.api.dto.ThemeSummaryDto;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ThemePortfolioCoverageAnalyzerTest {

  private ThemePortfolioCoverageAnalyzer analyzer;

  @BeforeEach
  void setUp() {
    analyzer = new ThemePortfolioCoverageAnalyzer();
  }

  private ThemeSummaryDto theme(String id, String name, String signal) {
    return new ThemeSummaryDto(
        id, name, "Thesis", 3, 0.70, null, null, null, null, 2, signal, null,
        "MOMENTUM", List.of(), 0, 0, 0, null, null, null, null, "LOW",
        null, null, null, 70, "HIGH", 80, "A", 75, "B");
  }

  private HoldingDto holding(String ticker, String categoryId, BigDecimal marketValueEur) {
    return new HoldingDto(ticker, ticker + " Fund", categoryId, "USD",
        BigDecimal.TEN, BigDecimal.valueOf(100), null, null, null, null, null, marketValueEur);
  }

  @Test
  @DisplayName("theme with a matching holding is marked covered")
  void themeWithMatchingHoldingIsCovered() {
    List<ThemeSummaryDto> themes = List.of(theme("AI", "AI Theme", "BUY"));
    Map<String, List<String>> constituents = Map.of("AI", List.of("SEMI", "AIRO"));
    List<HoldingDto> holdings = List.of(holding("SMH", "SEMI", BigDecimal.valueOf(5000)));

    List<ThemePortfolioCoverageDto> result =
        analyzer.analyze(themes, constituents, holdings, BigDecimal.valueOf(10000));

    assertThat(result).hasSize(1);
    ThemePortfolioCoverageDto dto = result.get(0);
    assertThat(dto.covered()).isTrue();
    assertThat(dto.coveringTickers()).containsExactly("SMH");
  }

  @Test
  @DisplayName("theme without a matching holding is marked uncovered")
  void themeWithoutMatchingHoldingIsUncovered() {
    List<ThemeSummaryDto> themes = List.of(theme("DEFENSE", "Defense", "WATCH"));
    Map<String, List<String>> constituents = Map.of("DEFENSE", List.of("INDU_ADEF", "MATL_STEE"));
    List<HoldingDto> holdings = List.of(holding("QQQ", "TECH", BigDecimal.valueOf(5000)));

    List<ThemePortfolioCoverageDto> result =
        analyzer.analyze(themes, constituents, holdings, BigDecimal.valueOf(5000));

    assertThat(result).hasSize(1);
    ThemePortfolioCoverageDto dto = result.get(0);
    assertThat(dto.covered()).isFalse();
    assertThat(dto.coveringTickers()).isEmpty();
    assertThat(dto.portfolioExposurePct()).isZero();
  }

  @Test
  @DisplayName("portfolio exposure percentage is computed correctly")
  void portfolioExposurePctIsCorrect() {
    List<ThemeSummaryDto> themes = List.of(theme("AI", "AI Theme", "BUY"));
    Map<String, List<String>> constituents = Map.of("AI", List.of("SEMI"));
    List<HoldingDto> holdings = List.of(holding("SMH", "SEMI", BigDecimal.valueOf(3000)));

    List<ThemePortfolioCoverageDto> result =
        analyzer.analyze(themes, constituents, holdings, BigDecimal.valueOf(10000));

    assertThat(result.get(0).portfolioExposurePct()).isCloseTo(30.0, offset(0.01));
  }

  @Test
  @DisplayName("multiple holdings covering the same theme aggregate their exposure")
  void multipleHoldingsAggregateExposure() {
    List<ThemeSummaryDto> themes = List.of(theme("AI", "AI Theme", "BUY"));
    Map<String, List<String>> constituents = Map.of("AI", List.of("SEMI", "AIRO"));
    List<HoldingDto> holdings = List.of(
        holding("SMH", "SEMI", BigDecimal.valueOf(2000)),
        holding("BOTZ", "AIRO", BigDecimal.valueOf(3000)));

    List<ThemePortfolioCoverageDto> result =
        analyzer.analyze(themes, constituents, holdings, BigDecimal.valueOf(10000));

    ThemePortfolioCoverageDto dto = result.get(0);
    assertThat(dto.covered()).isTrue();
    assertThat(dto.coveringTickers()).containsExactlyInAnyOrder("SMH", "BOTZ");
    assertThat(dto.portfolioExposurePct()).isCloseTo(50.0, offset(0.01));
  }

  @Test
  @DisplayName("holdings without categoryId are ignored")
  void holdingsWithoutCategoryIdAreIgnored() {
    List<ThemeSummaryDto> themes = List.of(theme("AI", "AI Theme", "BUY"));
    Map<String, List<String>> constituents = Map.of("AI", List.of("SEMI"));
    List<HoldingDto> holdings = List.of(holding("AAPL", null, BigDecimal.valueOf(5000)));

    List<ThemePortfolioCoverageDto> result =
        analyzer.analyze(themes, constituents, holdings, BigDecimal.valueOf(5000));

    assertThat(result.get(0).covered()).isFalse();
  }

  @Test
  @DisplayName("empty holdings list marks all themes uncovered")
  void emptyHoldingsAllThemesUncovered() {
    List<ThemeSummaryDto> themes = List.of(
        theme("AI", "AI Theme", "BUY"),
        theme("DEFENSE", "Defense", "WATCH"));
    Map<String, List<String>> constituents = Map.of(
        "AI", List.of("SEMI"),
        "DEFENSE", List.of("INDU_ADEF"));

    List<ThemePortfolioCoverageDto> result =
        analyzer.analyze(themes, constituents, List.of(), BigDecimal.ZERO);

    assertThat(result).allMatch(dto -> !dto.covered());
    assertThat(result).allMatch(dto -> dto.portfolioExposurePct() == 0.0);
  }

  @Test
  @DisplayName("theme with no constituents in repo is always uncovered")
  void themeWithNoConstituentsIsUncovered() {
    List<ThemeSummaryDto> themes = List.of(theme("NEW_THEME", "New Theme", "BUY"));
    Map<String, List<String>> constituents = Map.of();
    List<HoldingDto> holdings = List.of(holding("QQQ", "TECH", BigDecimal.valueOf(5000)));

    List<ThemePortfolioCoverageDto> result =
        analyzer.analyze(themes, constituents, holdings, BigDecimal.valueOf(5000));

    assertThat(result.get(0).covered()).isFalse();
  }
}
