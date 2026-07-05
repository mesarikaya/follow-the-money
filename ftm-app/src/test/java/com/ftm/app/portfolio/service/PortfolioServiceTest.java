package com.ftm.app.portfolio.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ftm.app.api.dto.PortfolioEntryDto;
import com.ftm.app.api.dto.PortfolioResponse;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.CategoryType;
import com.ftm.app.domain.Portfolio;
import com.ftm.app.domain.SignalType;
import com.ftm.app.portfolio.repository.PortfolioRepository;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PortfolioServiceTest {

  @Mock PortfolioRepository portfolioRepository;
  @Mock CategoryRepository categoryRepository;
  @Mock SignalRepository signalRepository;
  @Mock AlignmentService alignmentService;
  // Real resolver — the rollup logic is pure and covered by its own test; here it must behave.
  @Spy CategoryHierarchyResolver categoryHierarchyResolver = new CategoryHierarchyResolver();
  @InjectMocks PortfolioService portfolioService;

  private Category techCategory() {
    return new Category(
        CategoryId.TECH, "Technology", CategoryType.EQUITY_SECTOR, "XLK", "SPY", 1, true, null);
  }

  @Test
  @DisplayName("savePortfolio persists entries when allocation sum is exactly 100")
  void shouldSaveWhenAllocationSumsToOneHundred() {
    List<PortfolioEntryDto> entries =
        List.of(
            new PortfolioEntryDto("TECH", new BigDecimal("60.00")),
            new PortfolioEntryDto("GOLD", new BigDecimal("40.00")));

    portfolioService.savePortfolio(entries);

    verify(portfolioRepository).replaceAll(any());
  }

  @Test
  @DisplayName("savePortfolio accepts allocation within ±0.5% tolerance")
  void shouldAcceptAllocationWithinTolerance() {
    List<PortfolioEntryDto> entries =
        List.of(
            new PortfolioEntryDto("TECH", new BigDecimal("60.30")),
            new PortfolioEntryDto("GOLD", new BigDecimal("39.80")));

    portfolioService.savePortfolio(entries);

    verify(portfolioRepository).replaceAll(any());
  }

  @Test
  @DisplayName("savePortfolio throws IllegalArgumentException when allocation sum is too low")
  void shouldThrowWhenAllocationSumIsTooLow() {
    List<PortfolioEntryDto> entries =
        List.of(new PortfolioEntryDto("TECH", new BigDecimal("50.00")));

    assertThatThrownBy(() -> portfolioService.savePortfolio(entries))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("100");
  }

  @Test
  @DisplayName("savePortfolio throws IllegalArgumentException when allocation sum exceeds 100.5")
  void shouldThrowWhenAllocationSumExceedsTolerance() {
    List<PortfolioEntryDto> entries =
        List.of(
            new PortfolioEntryDto("TECH", new BigDecimal("60.00")),
            new PortfolioEntryDto("GOLD", new BigDecimal("41.00")));

    assertThatThrownBy(() -> portfolioService.savePortfolio(entries))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("100");
  }

  @Test
  @DisplayName("getPortfolio returns ALIGNED label when alignment score >= 0.70")
  void shouldReturnAlignedLabelForHighScore() {
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(techCategory()));
    when(portfolioRepository.findAll())
        .thenReturn(
            List.of(
                new Portfolio(
                    CategoryId.TECH, new BigDecimal("100.00"), OffsetDateTime.now(), null)));
    when(signalRepository.findLatestByType(SignalType.COMPOSITE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.80")));
    when(signalRepository.findLatestByType(SignalType.RRG_QUADRANT)).thenReturn(Map.of());
    when(signalRepository.findLatestByType(SignalType.COMPOSITE_TREND_20D)).thenReturn(Map.of());
    when(signalRepository.findRealizedVolatility20d()).thenReturn(Map.of());
    when(alignmentService.computeVolatilityAdjustedOptimalAllocation(any(), any()))
        .thenReturn(Map.of("TECH", new BigDecimal("100.00")));
    when(alignmentService.computeAlignmentScore(any(), any())).thenReturn(new BigDecimal("0.75"));

    PortfolioResponse result = portfolioService.getPortfolio();

    assertThat(result.alignmentLabel()).isEqualTo("ALIGNED");
  }

  @Test
  @DisplayName("getPortfolio returns PARTIAL label when alignment score is between 0.40 and 0.70")
  void shouldReturnPartialLabelForMidScore() {
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(techCategory()));
    when(portfolioRepository.findAll()).thenReturn(List.of());
    when(signalRepository.findLatestByType(SignalType.COMPOSITE)).thenReturn(Map.of());
    when(signalRepository.findLatestByType(SignalType.RRG_QUADRANT)).thenReturn(Map.of());
    when(signalRepository.findLatestByType(SignalType.COMPOSITE_TREND_20D)).thenReturn(Map.of());
    when(signalRepository.findRealizedVolatility20d()).thenReturn(Map.of());
    when(alignmentService.computeVolatilityAdjustedOptimalAllocation(any(), any()))
        .thenReturn(Map.of());
    when(alignmentService.computeAlignmentScore(any(), any())).thenReturn(new BigDecimal("0.55"));

    PortfolioResponse result = portfolioService.getPortfolio();

    assertThat(result.alignmentLabel()).isEqualTo("PARTIAL");
  }

  @Test
  @DisplayName("getPortfolio returns MISALIGNED label when alignment score is below 0.40")
  void shouldReturnMisalignedLabelForLowScore() {
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(techCategory()));
    when(portfolioRepository.findAll()).thenReturn(List.of());
    when(signalRepository.findLatestByType(eq(SignalType.COMPOSITE))).thenReturn(Map.of());
    when(signalRepository.findLatestByType(eq(SignalType.RRG_QUADRANT))).thenReturn(Map.of());
    when(signalRepository.findLatestByType(eq(SignalType.COMPOSITE_TREND_20D)))
        .thenReturn(Map.of());
    when(signalRepository.findRealizedVolatility20d()).thenReturn(Map.of());
    when(alignmentService.computeVolatilityAdjustedOptimalAllocation(any(), any()))
        .thenReturn(Map.of());
    when(alignmentService.computeAlignmentScore(any(), any())).thenReturn(new BigDecimal("0.20"));

    PortfolioResponse result = portfolioService.getPortfolio();

    assertThat(result.alignmentLabel()).isEqualTo("MISALIGNED");
  }

  @Test
  @DisplayName("getPortfolio excludes sub-categories (parentId != null) from allocations")
  void shouldExcludeSubCategoriesFromAllocations() {
    Category subSector =
        new Category(
            CategoryId.TECH,
            "Semiconductors",
            CategoryType.EQUITY_SECTOR,
            "SEMI",
            "XLK",
            101,
            true,
            "TECH");
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(techCategory(), subSector));
    when(portfolioRepository.findAll()).thenReturn(List.of());
    when(signalRepository.findLatestByType(any())).thenReturn(Map.of());
    when(signalRepository.findRealizedVolatility20d()).thenReturn(Map.of());
    when(alignmentService.computeVolatilityAdjustedOptimalAllocation(any(), any()))
        .thenReturn(Map.of());
    when(alignmentService.computeAlignmentScore(any(), any())).thenReturn(BigDecimal.ZERO);

    PortfolioResponse result = portfolioService.getPortfolio();

    assertThat(result.allocations()).hasSize(1);
    assertThat(result.allocations().get(0).categoryId()).isEqualTo("TECH");
  }

  @Test
  @DisplayName("getPortfolio rolls a sub-category holding's allocation up into its parent sector")
  void shouldRollSubCategoryAllocationIntoParent() {
    Category semiSubSector =
        new Category(
            CategoryId.SEMI,
            "Semiconductors",
            CategoryType.EQUITY_SECTOR,
            "SMH",
            "XLK",
            101,
            true,
            "TECH");
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(techCategory(), semiSubSector));
    when(portfolioRepository.findAll())
        .thenReturn(
            List.of(
                new Portfolio(CategoryId.TECH, new BigDecimal("70.00"), OffsetDateTime.now(), null),
                new Portfolio(
                    CategoryId.SEMI, new BigDecimal("30.00"), OffsetDateTime.now(), null)));
    when(signalRepository.findLatestByType(any())).thenReturn(Map.of());
    when(signalRepository.findRealizedVolatility20d()).thenReturn(Map.of());
    when(alignmentService.computeVolatilityAdjustedOptimalAllocation(any(), any()))
        .thenReturn(Map.of());
    when(alignmentService.computeAlignmentScore(any(), any())).thenReturn(BigDecimal.ZERO);

    PortfolioResponse result = portfolioService.getPortfolio();

    // Only the parent sector is listed, and it carries the summed 70 + 30 = 100.
    assertThat(result.allocations()).hasSize(1);
    assertThat(result.allocations().get(0).categoryId()).isEqualTo("TECH");
    assertThat(result.allocations().get(0).allocationPct()).isEqualByComparingTo("100.00");
  }

  @Test
  @DisplayName("optimal/alignment universe excludes sub-category and factor composites")
  @SuppressWarnings("unchecked")
  void topLevelCompositeUniverseExcludesSubCategories() {
    Category semiSubSector =
        new Category(
            CategoryId.SEMI,
            "Semiconductors",
            CategoryType.EQUITY_SECTOR,
            "SMH",
            "XLK",
            101,
            true,
            "TECH");
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(techCategory(), semiSubSector));
    when(portfolioRepository.findAll()).thenReturn(List.of());
    // Composite universe includes a top-level (TECH) and a sub-category (SEMI); only TECH is a
    // portfolio category, so SEMI must be excluded from the optimal/alignment universe.
    when(signalRepository.findLatestByType(SignalType.COMPOSITE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.80"), "SEMI", new BigDecimal("0.90")));
    when(signalRepository.findLatestByType(SignalType.RRG_QUADRANT)).thenReturn(Map.of());
    when(signalRepository.findLatestByType(SignalType.COMPOSITE_TREND_20D)).thenReturn(Map.of());
    when(signalRepository.findRealizedVolatility20d()).thenReturn(Map.of());
    when(alignmentService.computeVolatilityAdjustedOptimalAllocation(any(), any()))
        .thenReturn(Map.of());
    when(alignmentService.computeAlignmentScore(any(), any())).thenReturn(BigDecimal.ZERO);

    portfolioService.getPortfolio();

    ArgumentCaptor<Map<String, BigDecimal>> optimalUniverse = ArgumentCaptor.forClass(Map.class);
    verify(alignmentService)
        .computeVolatilityAdjustedOptimalAllocation(optimalUniverse.capture(), any());
    assertThat(optimalUniverse.getValue()).containsKey("TECH").doesNotContainKey("SEMI");

    ArgumentCaptor<Map<String, BigDecimal>> alignmentUniverse = ArgumentCaptor.forClass(Map.class);
    verify(alignmentService).computeAlignmentScore(any(), alignmentUniverse.capture());
    assertThat(alignmentUniverse.getValue()).containsKey("TECH").doesNotContainKey("SEMI");
  }
}
