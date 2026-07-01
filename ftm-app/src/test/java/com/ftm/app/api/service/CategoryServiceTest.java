package com.ftm.app.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ftm.app.api.dto.CategoriesResponse;
import com.ftm.app.api.dto.CategorySummaryDto;
import com.ftm.app.api.dto.PriceLevelDto;
import com.ftm.app.api.dto.ScreenerSnapshotDto;
import com.ftm.app.api.dto.SeasonalReturnDto;
import com.ftm.app.api.dto.SignalWinRateDto;
import com.ftm.app.api.mapper.CategoryMapper;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.api.repository.CategoryRepository.CategoryPriceRow;
import com.ftm.app.api.repository.CategoryRepository.PriceLevelRow;
import com.ftm.app.api.repository.CategoryRepository.SeasonalRow;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.CategoryType;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.signals.repository.SignalRepository.BuySignalWinRateRow;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.instancio.Instancio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CategoryServiceTest {

  @Mock CategoryRepository categoryRepository;
  @Mock SignalRepository signalRepository;
  @Mock CategoryMapper categoryMapper;
  @Mock AlertService alertService;
  @InjectMocks CategoryService categoryService;

  @Test
  @DisplayName("getCompositeScoreHistory returns only top-level category scores from DB")
  void shouldReturnOnlyTopLevelCategoryScoresFromDb() {
    when(categoryRepository.findTopLevelActiveCategoryIds()).thenReturn(Set.of("TECH", "FINL"));
    when(signalRepository.findCompositeScoreHistory(eq(30), anyCollection()))
        .thenReturn(
            Map.of(
                "TECH", List.of(new BigDecimal("0.70"), new BigDecimal("0.75")),
                "FINL", List.of(new BigDecimal("0.50"))));

    Map<String, List<Double>> result = categoryService.getCompositeScoreHistory(30);

    assertThat(result).containsOnlyKeys("TECH", "FINL");
    assertThat(result.get("TECH")).containsExactly(0.70, 0.75);
    assertThat(result.get("FINL")).containsExactly(0.50);
  }

  @Test
  @DisplayName("getCompositeScoreHistory converts null BigDecimal values to null Double")
  void shouldConvertNullSignalValuesToNullDouble() {
    when(categoryRepository.findTopLevelActiveCategoryIds()).thenReturn(Set.of("TECH"));
    List<BigDecimal> valuesWithNull = new ArrayList<>();
    valuesWithNull.add(new BigDecimal("0.60"));
    valuesWithNull.add(null);
    valuesWithNull.add(new BigDecimal("0.65"));
    when(signalRepository.findCompositeScoreHistory(eq(10), anyCollection()))
        .thenReturn(Map.of("TECH", valuesWithNull));

    Map<String, List<Double>> result = categoryService.getCompositeScoreHistory(10);

    List<Double> history = result.get("TECH");
    assertThat(history).hasSize(3);
    assertThat(history.get(0)).isEqualTo(0.60);
    assertThat(history.get(1)).isNull();
    assertThat(history.get(2)).isEqualTo(0.65);
  }

  @Test
  @DisplayName("getCompositeScoreHistory clamps days below minimum to 5")
  void shouldClampDaysBelowMinimumToFive() {
    when(categoryRepository.findTopLevelActiveCategoryIds()).thenReturn(Set.of());
    when(signalRepository.findCompositeScoreHistory(eq(5), anyCollection())).thenReturn(Map.of());

    categoryService.getCompositeScoreHistory(2);

    verify(signalRepository).findCompositeScoreHistory(eq(5), anyCollection());
  }

  @Test
  @DisplayName("getCompositeScoreHistory clamps days above maximum to 120")
  void shouldClampDaysAboveMaximumToOneTwenty() {
    when(categoryRepository.findTopLevelActiveCategoryIds()).thenReturn(Set.of());
    when(signalRepository.findCompositeScoreHistory(eq(120), anyCollection())).thenReturn(Map.of());

    categoryService.getCompositeScoreHistory(200);

    verify(signalRepository).findCompositeScoreHistory(eq(120), anyCollection());
  }

  @Test
  @DisplayName("getCompositeScoreHistory returns empty map when repository returns empty")
  void shouldReturnEmptyMapWhenRepositoryReturnsEmpty() {
    when(categoryRepository.findTopLevelActiveCategoryIds()).thenReturn(Set.of("TECH"));
    when(signalRepository.findCompositeScoreHistory(anyInt(), anyCollection()))
        .thenReturn(Map.of());

    Map<String, List<Double>> result = categoryService.getCompositeScoreHistory(30);

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("getCompositeScoreHistory passes top-level IDs as filter to repository")
  void shouldPassTopLevelIdsToRepository() {
    Set<String> topLevelIds = Set.of("TECH", "FINL", "HLTH");
    when(categoryRepository.findTopLevelActiveCategoryIds()).thenReturn(topLevelIds);
    when(signalRepository.findCompositeScoreHistory(eq(30), eq(topLevelIds))).thenReturn(Map.of());

    categoryService.getCompositeScoreHistory(30);

    verify(signalRepository).findCompositeScoreHistory(30, topLevelIds);
  }

  // ===== getCategoriesResponse — timeframe routing =====

  @Test
  @DisplayName("getCategoriesResponse fetches RS_20 (not RS_60) for WEEK timeframe")
  void shouldFetchRs20ForWeekTimeframe() {
    when(categoryRepository.findAllWithLatestPrice()).thenReturn(List.of());
    when(signalRepository.findLatestByTypes(any())).thenReturn(Map.of());
    when(alertService.getActiveAlertCountsByCategory()).thenReturn(Map.of());

    categoryService.getCategoriesResponse("WEEK");

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<SignalType>> captor = ArgumentCaptor.forClass(List.class);
    verify(signalRepository).findLatestByTypes(captor.capture());
    assertThat(captor.getValue()).contains(SignalType.RS_20);
    assertThat(captor.getValue()).doesNotContain(SignalType.RS_60);
  }

  @Test
  @DisplayName("getCategoriesResponse fetches RS_120 as primary for YEAR timeframe (deduplicated)")
  void shouldFetchRs120AsPrimaryForYearTimeframe() {
    when(categoryRepository.findAllWithLatestPrice()).thenReturn(List.of());
    when(signalRepository.findLatestByTypes(any())).thenReturn(Map.of());
    when(alertService.getActiveAlertCountsByCategory()).thenReturn(Map.of());

    categoryService.getCategoriesResponse("YEAR");

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<SignalType>> captor = ArgumentCaptor.forClass(List.class);
    verify(signalRepository).findLatestByTypes(captor.capture());
    assertThat(captor.getValue()).contains(SignalType.RS_120);
    assertThat(captor.getValue()).doesNotContain(SignalType.RS_60);
    // RS_120 appears only once after deduplication
    assertThat(captor.getValue().stream().filter(SignalType.RS_120::equals).count()).isEqualTo(1);
    // RS_20 is always fetched for the rs20 DTO field, regardless of timeframe
    assertThat(captor.getValue()).contains(SignalType.RS_20);
  }

  @Test
  @DisplayName("getCategoriesResponse fetches RS_60 for MONTH timeframe (default)")
  void shouldFetchRs60ForMonthTimeframe() {
    when(categoryRepository.findAllWithLatestPrice()).thenReturn(List.of());
    when(signalRepository.findLatestByTypes(any())).thenReturn(Map.of());
    when(alertService.getActiveAlertCountsByCategory()).thenReturn(Map.of());

    categoryService.getCategoriesResponse("MONTH");

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<SignalType>> captor = ArgumentCaptor.forClass(List.class);
    verify(signalRepository).findLatestByTypes(captor.capture());
    // RS_60 and RS_120 are always present; RS_20 is now also always fetched for the rs20 DTO field
    assertThat(captor.getValue()).contains(SignalType.RS_60, SignalType.RS_120, SignalType.RS_20);
  }

  @Test
  @DisplayName("getCategoriesResponse always includes MACRO_FIT in fetched signal types")
  void shouldAlwaysIncludeMacroFitInFetchedSignalTypes() {
    when(categoryRepository.findAllWithLatestPrice()).thenReturn(List.of());
    when(signalRepository.findLatestByTypes(any())).thenReturn(Map.of());
    when(alertService.getActiveAlertCountsByCategory()).thenReturn(Map.of());

    categoryService.getCategoriesResponse("MONTH");

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<SignalType>> captor = ArgumentCaptor.forClass(List.class);
    verify(signalRepository).findLatestByTypes(captor.capture());
    assertThat(captor.getValue()).contains(SignalType.MACRO_FIT);
  }

  @Test
  @DisplayName("getCategoriesResponse returns empty categories list when no rows exist")
  void shouldReturnEmptyCategoriesWhenNoRowsExist() {
    when(categoryRepository.findAllWithLatestPrice()).thenReturn(List.of());
    when(signalRepository.findLatestByTypes(any())).thenReturn(Map.of());
    when(alertService.getActiveAlertCountsByCategory()).thenReturn(Map.of());

    CategoriesResponse result = categoryService.getCategoriesResponse("MONTH");

    assertThat(result.categories()).isEmpty();
  }

  @Test
  @DisplayName(
      "getCategoriesResponse treats null timeframe as MONTH (uses RS_60, not RS_20 or RS_120)")
  void shouldTreatNullTimeframeAsMonth() {
    when(categoryRepository.findAllWithLatestPrice()).thenReturn(List.of());
    when(signalRepository.findLatestByTypes(any())).thenReturn(Map.of());
    when(alertService.getActiveAlertCountsByCategory()).thenReturn(Map.of());

    categoryService.getCategoriesResponse(null);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<SignalType>> captor = ArgumentCaptor.forClass(List.class);
    verify(signalRepository).findLatestByTypes(captor.capture());
    assertThat(captor.getValue()).contains(SignalType.RS_60);
    // RS_20 is always fetched for the rs20 DTO field even when timeframe maps to RS_60
    assertThat(captor.getValue()).contains(SignalType.RS_20);
  }

  @Test
  @DisplayName("getCategoriesResponse returns one DTO per row with sequential ranks")
  void shouldReturnOneDtoPerRowWithSequentialRanks() {
    Category tech =
        new Category(
            CategoryId.TECH, "Technology", CategoryType.EQUITY_SECTOR, "XLK", "SPY", 1, true, null);
    Category hlth =
        new Category(
            CategoryId.HLTH,
            "Health Care",
            CategoryType.EQUITY_SECTOR,
            "XLV",
            "SPY",
            5,
            true,
            null);
    CategoryPriceRow row1 =
        new CategoryPriceRow(tech, new BigDecimal("185.00"), LocalDate.of(2024, 6, 1));
    CategoryPriceRow row2 =
        new CategoryPriceRow(hlth, new BigDecimal("145.00"), LocalDate.of(2024, 6, 1));
    when(categoryRepository.findAllWithLatestPrice()).thenReturn(List.of(row1, row2));
    when(signalRepository.findLatestByTypes(any())).thenReturn(Map.of());
    CategorySummaryDto dto1 = Instancio.create(CategorySummaryDto.class);
    CategorySummaryDto dto2 = Instancio.create(CategorySummaryDto.class);
    when(signalRepository.findSignalDaysActive(any())).thenReturn(Map.of());
    when(signalRepository.findRealizedVolatility20d()).thenReturn(Map.of());
    when(signalRepository.findScorePercentile252d()).thenReturn(Map.of());
    when(alertService.getActiveAlertCountsByCategory()).thenReturn(Map.of());
    when(signalRepository.findScoreStreakDays()).thenReturn(Map.of());
    when(categoryMapper.toDto(
            eq(row1), eq(1), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(),
            any(), any(), any(), any(), any(), any(), any(), any()))
        .thenReturn(dto1);
    when(categoryMapper.toDto(
            eq(row2), eq(2), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(),
            any(), any(), any(), any(), any(), any(), any(), any()))
        .thenReturn(dto2);

    CategoriesResponse result = categoryService.getCategoriesResponse("MONTH");

    assertThat(result.categories()).containsExactly(dto1, dto2);
  }

  // ===== getPriceLevels =====

  @Test
  @DisplayName("getPriceLevels maps repository rows to PriceLevelDto")
  void shouldMapPriceLevelRowsToDto() {
    PriceLevelRow row =
        new PriceLevelRow(
            "TECH",
            new BigDecimal("192.5"),
            new BigDecimal("205.0"),
            new BigDecimal("152.0"),
            new BigDecimal("-0.061"),
            new BigDecimal("0.76"),
            252);

    when(categoryRepository.findPriceLevels()).thenReturn(List.of(row));

    List<PriceLevelDto> result = categoryService.getPriceLevels();

    assertThat(result).hasSize(1);
    PriceLevelDto dto = result.get(0);
    assertThat(dto.categoryId()).isEqualTo("TECH");
    assertThat(dto.currentPrice()).isEqualByComparingTo("192.5");
    assertThat(dto.high52w()).isEqualByComparingTo("205.0");
    assertThat(dto.low52w()).isEqualByComparingTo("152.0");
    assertThat(dto.drawdownFromHigh()).isEqualByComparingTo("-0.061");
    assertThat(dto.positionInRange()).isEqualByComparingTo("0.76");
    assertThat(dto.daysOfData()).isEqualTo(252);
  }

  @Test
  @DisplayName("getPriceLevels returns empty list when repository returns no rows")
  void shouldReturnEmptyListWhenNoPriceLevels() {
    when(categoryRepository.findPriceLevels()).thenReturn(List.of());

    List<PriceLevelDto> result = categoryService.getPriceLevels();

    assertThat(result).isEmpty();
  }

  // ===== getBuySignalWinRates =====

  @Test
  @DisplayName("getBuySignalWinRates maps repository rows to SignalWinRateDto including 90d return")
  void shouldMapWinRateRowsToDto() {
    BuySignalWinRateRow row =
        new BuySignalWinRateRow(
            "TECH", 42, new BigDecimal("0.74"), new BigDecimal("0.038"), new BigDecimal("0.092"));

    when(signalRepository.findBuySignalWinRates(365)).thenReturn(List.of(row));

    List<SignalWinRateDto> result = categoryService.getBuySignalWinRates(365);

    assertThat(result).hasSize(1);
    SignalWinRateDto dto = result.get(0);
    assertThat(dto.categoryId()).isEqualTo("TECH");
    assertThat(dto.signalCount()).isEqualTo(42);
    assertThat(dto.winRate()).isEqualByComparingTo("0.74");
    assertThat(dto.avgReturn30d()).isEqualByComparingTo("0.038");
    assertThat(dto.avgReturn90d()).isEqualByComparingTo("0.092");
  }

  @Test
  @DisplayName("getBuySignalWinRates maps null avgReturn90d when 90d data is unavailable")
  void shouldHandleNullAvgReturn90d() {
    BuySignalWinRateRow row =
        new BuySignalWinRateRow("TLTD", 12, new BigDecimal("0.50"), new BigDecimal("0.004"), null);

    when(signalRepository.findBuySignalWinRates(365)).thenReturn(List.of(row));

    List<SignalWinRateDto> result = categoryService.getBuySignalWinRates(365);

    assertThat(result.get(0).avgReturn90d()).isNull();
  }

  @Test
  @DisplayName("getBuySignalWinRates clamps lookback days to [90, 730]")
  void shouldClampWinRateLookbackDays() {
    when(signalRepository.findBuySignalWinRates(90)).thenReturn(List.of());
    when(signalRepository.findBuySignalWinRates(730)).thenReturn(List.of());

    categoryService.getBuySignalWinRates(30);
    verify(signalRepository).findBuySignalWinRates(90);

    categoryService.getBuySignalWinRates(999);
    verify(signalRepository).findBuySignalWinRates(730);
  }

  @Test
  @DisplayName("getCategoriesResponse calls findScoreStreakDays to populate server-side streak")
  void shouldCallFindScoreStreakDays() {
    when(categoryRepository.findAllWithLatestPrice()).thenReturn(List.of());
    when(signalRepository.findLatestByTypes(any())).thenReturn(Map.of());

    categoryService.getCategoriesResponse("MONTH");

    verify(signalRepository).findScoreStreakDays();
  }

  // ===== getSeasonalReturns =====

  @Test
  @DisplayName("getSeasonalReturns maps repository rows to SeasonalReturnDto")
  void shouldMapSeasonalReturnRowsToDto() {
    SeasonalRow row = new SeasonalRow("TECH", 6, new BigDecimal("0.031"), 5);

    when(categoryRepository.findSeasonalMonthlyReturns()).thenReturn(List.of(row));

    List<SeasonalReturnDto> result = categoryService.getSeasonalReturns();

    assertThat(result).hasSize(1);
    SeasonalReturnDto dto = result.get(0);
    assertThat(dto.categoryId()).isEqualTo("TECH");
    assertThat(dto.month()).isEqualTo(6);
    assertThat(dto.avgReturn()).isEqualByComparingTo("0.031");
    assertThat(dto.sampleCount()).isEqualTo(5);
  }

  @Test
  @DisplayName("getSeasonalReturns returns empty list when repository returns no rows")
  void shouldReturnEmptyListWhenNoSeasonalReturns() {
    when(categoryRepository.findSeasonalMonthlyReturns()).thenReturn(List.of());

    List<SeasonalReturnDto> result = categoryService.getSeasonalReturns();

    assertThat(result).isEmpty();
  }

  // ===== getScreenerSnapshot =====

  @Test
  @DisplayName("getScreenerSnapshot returns all zeros when no top-level categories exist")
  void shouldReturnAllZerosWhenNoTopLevelCategoriesExist() {
    when(categoryRepository.findTopLevelActiveCategoryIds()).thenReturn(Set.of());

    ScreenerSnapshotDto result = categoryService.getScreenerSnapshot();

    assertThat(result.buyCount()).isZero();
    assertThat(result.watchCount()).isZero();
    assertThat(result.holdCount()).isZero();
    assertThat(result.reduceCount()).isZero();
    assertThat(result.totalCategories()).isZero();
    assertThat(result.avgCompositeScore()).isZero();
  }

  @Test
  @DisplayName(
      "getScreenerSnapshot returns all zeros when top-level categories have no composite signal")
  void shouldReturnAllZerosWhenNoCompositeSignalData() {
    when(categoryRepository.findTopLevelActiveCategoryIds()).thenReturn(Set.of("TECH", "FINL"));
    when(signalRepository.findLatestByTypes(any())).thenReturn(Map.of());

    ScreenerSnapshotDto result = categoryService.getScreenerSnapshot();

    assertThat(result.totalCategories()).isZero();
    assertThat(result.buyCount()).isZero();
  }

  @Test
  @DisplayName(
      "getScreenerSnapshot computes correct BUY/WATCH/HOLD/REDUCE distribution and breadth metrics")
  void shouldComputeCorrectSignalDistributionAndBreadthMetrics() {
    // TECH: score=0.80, RRG=4(Leading),   trend=+0.05 → BUY;  rs60=0.10>0, rs20=0.15>rs60 → RS✓
    // MOM✓ RiskOn✓
    // FINL: score=0.55, RRG=3(Improving), trend=+0.03 → WATCH; rs60=0.05>0, rs20=0.02<rs60 → RS✓
    // MOM✗ RiskOn✓
    // HLTH: score=0.45, RRG=2(Weakening), trend=-0.02 → HOLD;  rs60=-0.02<0               → RS✗
    // MOM✗ RiskOn✗
    // ENRG: score=0.28, RRG=1(Lagging),   trend=-0.05 → REDUCE; rs60=-0.08<0, rs20=-0.10<rs60 → RS✗
    // MOM✗ RiskOn✗
    when(categoryRepository.findTopLevelActiveCategoryIds())
        .thenReturn(Set.of("TECH", "FINL", "HLTH", "ENRG"));
    when(signalRepository.findLatestByTypes(any()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE,
                    Map.of(
                        "TECH", new BigDecimal("0.80"),
                        "FINL", new BigDecimal("0.55"),
                        "HLTH", new BigDecimal("0.45"),
                        "ENRG", new BigDecimal("0.28")),
                SignalType.RRG_QUADRANT,
                    Map.of(
                        "TECH", new BigDecimal("4"),
                        "FINL", new BigDecimal("3"),
                        "HLTH", new BigDecimal("2"),
                        "ENRG", new BigDecimal("1")),
                SignalType.COMPOSITE_TREND_20D,
                    Map.of(
                        "TECH", new BigDecimal("0.05"),
                        "FINL", new BigDecimal("0.03"),
                        "HLTH", new BigDecimal("-0.02"),
                        "ENRG", new BigDecimal("-0.05")),
                SignalType.RS_60,
                    Map.of(
                        "TECH", new BigDecimal("0.10"),
                        "FINL", new BigDecimal("0.05"),
                        "HLTH", new BigDecimal("-0.02"),
                        "ENRG", new BigDecimal("-0.08")),
                SignalType.RS_20,
                    Map.of(
                        "TECH", new BigDecimal("0.15"),
                        "FINL", new BigDecimal("0.02"),
                        "HLTH", new BigDecimal("-0.03"),
                        "ENRG", new BigDecimal("-0.10"))));

    ScreenerSnapshotDto result = categoryService.getScreenerSnapshot();

    assertThat(result.buyCount()).isEqualTo(1);
    assertThat(result.watchCount()).isEqualTo(1);
    assertThat(result.holdCount()).isEqualTo(1);
    assertThat(result.reduceCount()).isEqualTo(1);
    assertThat(result.totalCategories()).isEqualTo(4);
    // avgCompositeScore = (0.80+0.55+0.45+0.28)/4 = 0.52
    assertThat(result.avgCompositeScore()).isEqualTo(0.52);
    // 2 of 4 categories have rs60 > 0
    assertThat(result.rsBreadthPct()).isEqualTo(50.0);
    // 1 of 4 has rs20 > rs60 (only TECH: 0.15 > 0.10)
    assertThat(result.momentumBreadthPct()).isEqualTo(25.0);
    // 2 of 4 in Leading/Improving quadrant (TECH=4, FINL=3)
    assertThat(result.riskOnPct()).isEqualTo(50.0);
  }
}
