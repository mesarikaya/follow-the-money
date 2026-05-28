package com.ftm.app.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

import com.ftm.app.api.mapper.CategoryMapper;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
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
  @DisplayName("getCompositeScoreHistory filters out sub-sector categories")
  void shouldFilterSubSectorsFromScoreHistory() {
    when(categoryRepository.findTopLevelActiveCategoryIds())
        .thenReturn(Set.of("TECH", "FINL"));
    when(signalRepository.findCompositeScoreHistory(30))
        .thenReturn(
            Map.of(
                "TECH", List.of(new BigDecimal("0.70"), new BigDecimal("0.75")),
                "FINL", List.of(new BigDecimal("0.50")),
                "SEMI", List.of(new BigDecimal("0.90")))); // sub-sector — must be excluded

    Map<String, List<Double>> result = categoryService.getCompositeScoreHistory(30);

    assertThat(result).containsOnlyKeys("TECH", "FINL");
    assertThat(result.get("TECH")).containsExactly(0.70, 0.75);
    assertThat(result.get("FINL")).containsExactly(0.50);
  }

  @Test
  @DisplayName("getCompositeScoreHistory converts null BigDecimal values to null Double")
  void shouldConvertNullSignalValuesToNullDouble() {
    when(categoryRepository.findTopLevelActiveCategoryIds()).thenReturn(Set.of("TECH"));
    List<BigDecimal> valuesWithNull = new java.util.ArrayList<>();
    valuesWithNull.add(new BigDecimal("0.60"));
    valuesWithNull.add(null);
    valuesWithNull.add(new BigDecimal("0.65"));
    when(signalRepository.findCompositeScoreHistory(10)).thenReturn(Map.of("TECH", valuesWithNull));

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
    when(signalRepository.findCompositeScoreHistory(5)).thenReturn(Map.of());

    categoryService.getCompositeScoreHistory(2); // below minimum

    org.mockito.Mockito.verify(signalRepository).findCompositeScoreHistory(5);
  }

  @Test
  @DisplayName("getCompositeScoreHistory clamps days above maximum to 120")
  void shouldClampDaysAboveMaximumToOneTwenty() {
    when(categoryRepository.findTopLevelActiveCategoryIds()).thenReturn(Set.of());
    when(signalRepository.findCompositeScoreHistory(120)).thenReturn(Map.of());

    categoryService.getCompositeScoreHistory(200); // above maximum

    org.mockito.Mockito.verify(signalRepository).findCompositeScoreHistory(120);
  }

  @Test
  @DisplayName("getCompositeScoreHistory returns empty map when no history exists")
  void shouldReturnEmptyMapWhenNoHistoryExists() {
    when(categoryRepository.findTopLevelActiveCategoryIds()).thenReturn(Set.of("TECH"));
    when(signalRepository.findCompositeScoreHistory(30)).thenReturn(Map.of());

    Map<String, List<Double>> result = categoryService.getCompositeScoreHistory(30);

    assertThat(result).isEmpty();
  }
}
