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
import com.ftm.app.api.mapper.CategoryMapper;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.api.repository.CategoryRepository.CategoryPriceRow;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.CategoryType;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
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

    categoryService.getCategoriesResponse("WEEK");

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Collection<SignalType>> captor = ArgumentCaptor.forClass(Collection.class);
    verify(signalRepository).findLatestByTypes(captor.capture());
    assertThat(captor.getValue()).contains(SignalType.RS_20);
    assertThat(captor.getValue()).doesNotContain(SignalType.RS_60);
  }

  @Test
  @DisplayName("getCategoriesResponse fetches RS_120 as primary for YEAR timeframe (deduplicated)")
  void shouldFetchRs120AsPrimaryForYearTimeframe() {
    when(categoryRepository.findAllWithLatestPrice()).thenReturn(List.of());
    when(signalRepository.findLatestByTypes(any())).thenReturn(Map.of());

    categoryService.getCategoriesResponse("YEAR");

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Collection<SignalType>> captor = ArgumentCaptor.forClass(Collection.class);
    verify(signalRepository).findLatestByTypes(captor.capture());
    assertThat(captor.getValue()).contains(SignalType.RS_120);
    assertThat(captor.getValue()).doesNotContain(SignalType.RS_20);
    assertThat(captor.getValue()).doesNotContain(SignalType.RS_60);
    // RS_120 appears only once after deduplication
    assertThat(captor.getValue().stream().filter(SignalType.RS_120::equals).count()).isEqualTo(1);
  }

  @Test
  @DisplayName("getCategoriesResponse fetches RS_60 for MONTH timeframe (default)")
  void shouldFetchRs60ForMonthTimeframe() {
    when(categoryRepository.findAllWithLatestPrice()).thenReturn(List.of());
    when(signalRepository.findLatestByTypes(any())).thenReturn(Map.of());

    categoryService.getCategoriesResponse("MONTH");

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Collection<SignalType>> captor = ArgumentCaptor.forClass(Collection.class);
    verify(signalRepository).findLatestByTypes(captor.capture());
    assertThat(captor.getValue()).contains(SignalType.RS_60, SignalType.RS_120);
    assertThat(captor.getValue()).doesNotContain(SignalType.RS_20);
  }

  @Test
  @DisplayName("getCategoriesResponse always includes MACRO_FIT in fetched signal types")
  void shouldAlwaysIncludeMacroFitInFetchedSignalTypes() {
    when(categoryRepository.findAllWithLatestPrice()).thenReturn(List.of());
    when(signalRepository.findLatestByTypes(any())).thenReturn(Map.of());

    categoryService.getCategoriesResponse("MONTH");

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Collection<SignalType>> captor = ArgumentCaptor.forClass(Collection.class);
    verify(signalRepository).findLatestByTypes(captor.capture());
    assertThat(captor.getValue()).contains(SignalType.MACRO_FIT);
  }

  @Test
  @DisplayName("getCategoriesResponse returns empty categories list when no rows exist")
  void shouldReturnEmptyCategoriesWhenNoRowsExist() {
    when(categoryRepository.findAllWithLatestPrice()).thenReturn(List.of());
    when(signalRepository.findLatestByTypes(any())).thenReturn(Map.of());

    CategoriesResponse result = categoryService.getCategoriesResponse("MONTH");

    assertThat(result.categories()).isEmpty();
  }

  @Test
  @DisplayName("getCategoriesResponse treats null timeframe as MONTH (uses RS_60, not RS_20 or RS_120)")
  void shouldTreatNullTimeframeAsMonth() {
    when(categoryRepository.findAllWithLatestPrice()).thenReturn(List.of());
    when(signalRepository.findLatestByTypes(any())).thenReturn(Map.of());

    categoryService.getCategoriesResponse(null);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Collection<SignalType>> captor = ArgumentCaptor.forClass(Collection.class);
    verify(signalRepository).findLatestByTypes(captor.capture());
    assertThat(captor.getValue()).contains(SignalType.RS_60);
    assertThat(captor.getValue()).doesNotContain(SignalType.RS_20);
  }

  @Test
  @DisplayName("getCategoriesResponse returns one DTO per row with sequential ranks")
  void shouldReturnOneDtoPerRowWithSequentialRanks() {
    Category tech = new Category(CategoryId.TECH, "Technology", CategoryType.EQUITY_SECTOR, "XLK", "SPY", 1, true, null);
    Category hlth = new Category(CategoryId.HLTH, "Health Care", CategoryType.EQUITY_SECTOR, "XLV", "SPY", 5, true, null);
    CategoryPriceRow row1 = new CategoryPriceRow(tech, new BigDecimal("185.00"), LocalDate.of(2024, 6, 1));
    CategoryPriceRow row2 = new CategoryPriceRow(hlth, new BigDecimal("145.00"), LocalDate.of(2024, 6, 1));
    when(categoryRepository.findAllWithLatestPrice()).thenReturn(List.of(row1, row2));
    when(signalRepository.findLatestByTypes(any())).thenReturn(Map.of());
    CategorySummaryDto dto1 = Instancio.create(CategorySummaryDto.class);
    CategorySummaryDto dto2 = Instancio.create(CategorySummaryDto.class);
    when(categoryMapper.toDto(eq(row1), eq(1), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
        .thenReturn(dto1);
    when(categoryMapper.toDto(eq(row2), eq(2), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
        .thenReturn(dto2);

    CategoriesResponse result = categoryService.getCategoriesResponse("MONTH");

    assertThat(result.categories()).containsExactly(dto1, dto2);
  }
}
