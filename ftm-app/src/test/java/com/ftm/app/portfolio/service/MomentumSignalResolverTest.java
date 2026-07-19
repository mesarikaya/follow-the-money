package com.ftm.app.portfolio.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.ftm.app.category.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.CategoryType;
import java.math.BigDecimal;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MomentumSignalResolverTest {

  @Mock CategoryRepository categoryRepository;
  @Mock LiveMomentumScoreService liveMomentumScoreService;

  private MomentumSignalResolver resolver() {
    return new MomentumSignalResolver(
        categoryRepository, liveMomentumScoreService, new AlignmentService());
  }

  private Category category(CategoryId id, CategoryType type) {
    return new Category(id, id.name(), type, null, null, 1, true, null);
  }

  private Map<String, Category> equitySectors(CategoryId... ids) {
    return java.util.Arrays.stream(ids)
        .collect(
            java.util.stream.Collectors.toMap(
                CategoryId::name, id -> category(id, CategoryType.EQUITY_SECTOR)));
  }

  @Test
  @DisplayName("top-N by momentum are BUY, positive-but-unselected are HOLD, negative are REDUCE")
  void shouldDeriveSignalsFromRankAndSign() {
    when(liveMomentumScoreService.computeLatestMomentumByCategoryId())
        .thenReturn(
            Map.of(
                "TECH", new BigDecimal("0.30"),
                "ENRG", new BigDecimal("0.20"),
                "INDU", new BigDecimal("0.10"),
                "STPL", new BigDecimal("0.05"),
                "HLTH", new BigDecimal("-0.08")));

    MomentumSignalResolver.MomentumSignals signals =
        resolver()
            .resolve(
                equitySectors(
                    CategoryId.TECH,
                    CategoryId.ENRG,
                    CategoryId.INDU,
                    CategoryId.STPL,
                    CategoryId.HLTH),
                PortfolioSelectionUniverse.EQUITY_SECTORS);

    // EQUITY_SECTORS holds the top 3.
    assertThat(signals.tradeSignalByCategoryId())
        .containsEntry("TECH", "BUY")
        .containsEntry("ENRG", "BUY")
        .containsEntry("INDU", "BUY")
        .containsEntry("STPL", "HOLD")
        .containsEntry("HLTH", "REDUCE");
  }

  @Test
  @DisplayName("the signal map agrees with the optimal allocation's key set — the coherence rule")
  void shouldKeepSignalsConsistentWithTheOptimalSelection() {
    when(liveMomentumScoreService.computeLatestMomentumByCategoryId())
        .thenReturn(
            Map.of(
                "TECH", new BigDecimal("0.30"),
                "ENRG", new BigDecimal("0.20"),
                "INDU", new BigDecimal("0.10"),
                "STPL", new BigDecimal("0.05")));

    MomentumSignalResolver.MomentumSignals signals =
        resolver()
            .resolve(
                equitySectors(CategoryId.TECH, CategoryId.ENRG, CategoryId.INDU, CategoryId.STPL),
                PortfolioSelectionUniverse.EQUITY_SECTORS);

    // This is the invariant the whole change rests on: a category is BUY if and only if it is in
    // the optimal allocation that /portfolio renders alongside it.
    signals
        .tradeSignalByCategoryId()
        .forEach(
            (categoryId, signal) ->
                assertThat("BUY".equals(signal))
                    .as("BUY iff selected, for %s", categoryId)
                    .isEqualTo(signals.optimalAllocationByCategoryId().containsKey(categoryId)));
  }

  @Test
  @DisplayName("a category outside the equity universe still gets a signal, never a null")
  void shouldScoreNonEquityCategoriesEvenThoughTheyCannotBeSelected() {
    when(liveMomentumScoreService.computeLatestMomentumByCategoryId())
        .thenReturn(Map.of("TECH", new BigDecimal("0.30"), "GOLD", new BigDecimal("0.15")));

    Map<String, Category> categories =
        Map.of(
            "TECH", category(CategoryId.TECH, CategoryType.EQUITY_SECTOR),
            "GOLD", category(CategoryId.GOLD, CategoryType.PRECIOUS_METAL));

    MomentumSignalResolver.MomentumSignals signals =
        resolver().resolve(categories, PortfolioSelectionUniverse.EQUITY_SECTORS);

    // GOLD has positive momentum but cannot be selected in the equity universe → HOLD, so a gold
    // holding reads "keep it", not UNCLASSIFIED and not REDUCE.
    assertThat(signals.tradeSignalByCategoryId()).containsEntry("GOLD", "HOLD");
    assertThat(signals.optimalAllocationByCategoryId()).doesNotContainKey("GOLD");
  }

  @Test
  @DisplayName("no price history yields no signals rather than a fabricated all-REDUCE portfolio")
  void shouldReturnEmptySignalsWhenMomentumIsUnavailable() {
    when(liveMomentumScoreService.computeLatestMomentumByCategoryId()).thenReturn(Map.of());

    MomentumSignalResolver.MomentumSignals signals =
        resolver()
            .resolve(equitySectors(CategoryId.TECH), PortfolioSelectionUniverse.EQUITY_SECTORS);

    assertThat(signals.tradeSignalByCategoryId()).isEmpty();
  }
}
