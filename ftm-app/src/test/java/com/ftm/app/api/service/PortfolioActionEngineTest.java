package com.ftm.app.api.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.ftm.app.api.dto.CategorySummaryDto;
import com.ftm.app.api.dto.HoldingActionDto;
import com.ftm.app.api.dto.HoldingDto;
import com.ftm.app.domain.CategoryId;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PortfolioActionEngineTest {

  private final PortfolioActionEngine engine = new PortfolioActionEngine();

  // ------------------------------------------------------------------ builders

  private HoldingDto holding(
      String ticker, String name, String categoryId, BigDecimal marketValueEur) {
    return new HoldingDto(
        ticker,
        name,
        categoryId,
        "USD",
        BigDecimal.TEN,
        new BigDecimal("100"),
        null,
        null,
        null,
        LocalDate.now(),
        null,
        marketValueEur);
  }

  private CategorySummaryDto category(
      CategoryId id,
      String tradeSignal,
      BigDecimal compositeScore,
      String rrgQuadrant,
      BigDecimal trend20d,
      Integer convictionScore) {
    return new CategorySummaryDto(
        id,
        id.name(),
        "EQUITY_SECTOR",
        "ETF",
        compositeScore,
        null,
        null,
        trend20d,
        rrgQuadrant,
        null,
        null,
        null,
        null,
        null,
        null,
        1,
        null,
        LocalDate.now(),
        tradeSignal,
        null,
        null,
        null,
        null,
        null,
        convictionScore,
        null,
        null,
        null);
  }

  // ------------------------------------------------------------------ EXIT

  @Test
  @DisplayName("EXIT for REDUCE signal with position above 5% threshold")
  void shouldReturnExitWhenReduceSignalAndPositionOversized() {
    // 6 000 / 100 000 = 6% → above 5% → EXIT
    HoldingDto enrg = holding("ENRG", "Energy ETF", "ENRG", new BigDecimal("6000"));
    CategorySummaryDto cat =
        category(
            CategoryId.ENRG, "REDUCE", new BigDecimal("0.30"), "2", new BigDecimal("-0.02"), 60);

    List<HoldingActionDto> actions =
        engine.deriveActions(List.of(enrg), Map.of("ENRG", cat), new BigDecimal("100000"));

    assertThat(actions).hasSize(1);
    HoldingActionDto action = actions.get(0);
    assertThat(action.action()).isEqualTo("EXIT");
    assertThat(action.urgency()).isEqualTo(1);
    assertThat(action.portfolioPct()).isGreaterThan(new BigDecimal("5.00"));
  }

  // ------------------------------------------------------------------ TRIM

  @Test
  @DisplayName("TRIM for REDUCE signal with small position under 5%")
  void shouldReturnTrimWhenReduceSignalAndPositionSmall() {
    // 3 000 / 100 000 = 3% → under 5% → TRIM
    HoldingDto finl = holding("XLF", "Financials", "FINL", new BigDecimal("3000"));
    CategorySummaryDto cat =
        category(
            CategoryId.FINL, "REDUCE", new BigDecimal("0.28"), "1", new BigDecimal("-0.01"), 55);

    List<HoldingActionDto> actions =
        engine.deriveActions(List.of(finl), Map.of("FINL", cat), new BigDecimal("100000"));

    assertThat(actions).hasSize(1);
    assertThat(actions.get(0).action()).isEqualTo("TRIM");
    assertThat(actions.get(0).urgency()).isEqualTo(2);
  }

  // ------------------------------------------------------------------ WATCH

  @Test
  @DisplayName("WATCH for WATCH signal regardless of position size")
  void shouldReturnWatchForWatchSignal() {
    HoldingDto hlth = holding("XLV", "Health Care", "HLTH", new BigDecimal("8000"));
    CategorySummaryDto cat =
        category(
            CategoryId.HLTH, "WATCH", new BigDecimal("0.55"), "4", new BigDecimal("-0.005"), 30);

    List<HoldingActionDto> actions =
        engine.deriveActions(List.of(hlth), Map.of("HLTH", cat), new BigDecimal("100000"));

    assertThat(actions).hasSize(1);
    assertThat(actions.get(0).action()).isEqualTo("WATCH");
    assertThat(actions.get(0).urgency()).isEqualTo(3);
  }

  // ------------------------------------------------------------------ HOLD

  @Test
  @DisplayName("HOLD for BUY signal")
  void shouldReturnHoldForBuySignal() {
    HoldingDto tech = holding("XLK", "Technology", "TECH", new BigDecimal("20000"));
    CategorySummaryDto cat =
        category(CategoryId.TECH, "BUY", new BigDecimal("0.78"), "4", new BigDecimal("0.03"), 85);

    List<HoldingActionDto> actions =
        engine.deriveActions(List.of(tech), Map.of("TECH", cat), new BigDecimal("100000"));

    assertThat(actions).hasSize(1);
    assertThat(actions.get(0).action()).isEqualTo("HOLD");
    assertThat(actions.get(0).urgency()).isEqualTo(4);
    assertThat(actions.get(0).convictionScore()).isEqualTo(85);
  }

  // ------------------------------------------------------------------ UNCLASSIFIED

  @Test
  @DisplayName("UNCLASSIFIED for holding with null categoryId")
  void shouldReturnUnclassifiedWhenCategoryIdIsNull() {
    HoldingDto mystery = holding("TSLA", "Tesla", null, new BigDecimal("5000"));

    List<HoldingActionDto> actions =
        engine.deriveActions(List.of(mystery), Map.of(), new BigDecimal("100000"));

    assertThat(actions).hasSize(1);
    assertThat(actions.get(0).action()).isEqualTo("UNCLASSIFIED");
    assertThat(actions.get(0).urgency()).isEqualTo(5);
    assertThat(actions.get(0).categoryId()).isNull();
  }

  // ------------------------------------------------------------------ UNCLASSIFIED (no map entry)

  @Test
  @DisplayName("UNCLASSIFIED when categoryId set but not in categories map")
  void shouldReturnUnclassifiedWhenCategoryNotInMap() {
    HoldingDto exotica = holding("EXOT", "Exotic ETF", "UNKNOWN", new BigDecimal("2000"));

    List<HoldingActionDto> actions =
        engine.deriveActions(List.of(exotica), Map.of(), new BigDecimal("100000"));

    assertThat(actions).hasSize(1);
    assertThat(actions.get(0).action()).isEqualTo("UNCLASSIFIED");
  }

  // ------------------------------------------------------------------ portfolio pct

  @Test
  @DisplayName("portfolioPct is computed correctly")
  void shouldComputePortfolioPctCorrectly() {
    HoldingDto h = holding("MATL", "Materials", "MATL", new BigDecimal("12500"));
    CategorySummaryDto cat =
        category(CategoryId.MATL, "BUY", new BigDecimal("0.70"), "4", new BigDecimal("0.02"), 70);

    List<HoldingActionDto> actions =
        engine.deriveActions(List.of(h), Map.of("MATL", cat), new BigDecimal("50000"));

    // 12500 / 50000 * 100 = 25.00%
    assertThat(actions.get(0).portfolioPct()).isEqualByComparingTo("25.00");
  }

  // ------------------------------------------------------------------ sort order

  @Test
  @DisplayName("results are sorted by urgency ascending (EXIT first, HOLD last)")
  void shouldSortByUrgencyAscending() {
    HoldingDto exitHolding = holding("ENRG", "Energy", "ENRG", new BigDecimal("8000"));
    HoldingDto holdHolding = holding("TECH", "Technology", "TECH", new BigDecimal("15000"));
    HoldingDto watchHolding = holding("HLTH", "Health", "HLTH", new BigDecimal("5000"));

    Map<String, CategorySummaryDto> cats =
        Map.of(
            "ENRG",
                category(
                    CategoryId.ENRG,
                    "REDUCE",
                    new BigDecimal("0.25"),
                    "2",
                    new BigDecimal("-0.02"),
                    60),
            "TECH",
                category(
                    CategoryId.TECH,
                    "BUY",
                    new BigDecimal("0.78"),
                    "4",
                    new BigDecimal("0.03"),
                    85),
            "HLTH",
                category(
                    CategoryId.HLTH,
                    "WATCH",
                    new BigDecimal("0.55"),
                    "4",
                    new BigDecimal("-0.005"),
                    30));

    List<HoldingActionDto> actions =
        engine.deriveActions(
            List.of(exitHolding, holdHolding, watchHolding), cats, new BigDecimal("100000"));

    assertThat(actions).hasSize(3);
    assertThat(actions.get(0).action()).isEqualTo("EXIT"); // urgency 1
    assertThat(actions.get(1).action()).isEqualTo("WATCH"); // urgency 3
    assertThat(actions.get(2).action()).isEqualTo("HOLD"); // urgency 4
  }

  // ------------------------------------------------------------------ signal derivation fallback

  @Test
  @DisplayName("derives signal from score/quadrant/trend when tradeSignal is null in category")
  void shouldDeriveSignalWhenCategoryTradeSignalIsNull() {
    // Score 0.70, quadrant 4, trend20d 0.02 → derived BUY
    HoldingDto gold = holding("GLD", "Gold", "GOLD", new BigDecimal("5000"));
    CategorySummaryDto cat =
        category(CategoryId.GOLD, null, new BigDecimal("0.70"), "4", new BigDecimal("0.02"), 0);

    List<HoldingActionDto> actions =
        engine.deriveActions(List.of(gold), Map.of("GOLD", cat), new BigDecimal("100000"));

    assertThat(actions.get(0).signal()).isEqualTo("BUY");
    assertThat(actions.get(0).action()).isEqualTo("HOLD");
  }

  // ------------------------------------------------------------------ empty holdings

  @Test
  @DisplayName("returns empty list when holdings list is empty")
  void shouldReturnEmptyListForEmptyHoldings() {
    List<HoldingActionDto> actions =
        engine.deriveActions(List.of(), Map.of(), new BigDecimal("100000"));
    assertThat(actions).isEmpty();
  }
}
