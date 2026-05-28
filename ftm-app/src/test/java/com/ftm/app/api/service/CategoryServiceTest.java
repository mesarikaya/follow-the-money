package com.ftm.app.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ftm.app.api.mapper.CategoryMapper;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
    when(categoryRepository.findTopLevelActiveCategoryIds())
        .thenReturn(Set.of("TECH", "FINL"));
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
    when(signalRepository.findCompositeScoreHistory(anyInt(), anyCollection())).thenReturn(Map.of());

    Map<String, List<Double>> result = categoryService.getCompositeScoreHistory(30);

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("getCompositeScoreHistory passes top-level IDs as filter to repository")
  void shouldPassTopLevelIdsToRepository() {
    Set<String> topLevelIds = Set.of("TECH", "FINL", "HLTH");
    when(categoryRepository.findTopLevelActiveCategoryIds()).thenReturn(topLevelIds);
    when(signalRepository.findCompositeScoreHistory(eq(30), eq(topLevelIds)))
        .thenReturn(Map.of());

    categoryService.getCompositeScoreHistory(30);

    verify(signalRepository).findCompositeScoreHistory(30, topLevelIds);
  }
}
