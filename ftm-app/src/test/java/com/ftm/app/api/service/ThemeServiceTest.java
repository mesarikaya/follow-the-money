package com.ftm.app.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.ftm.app.api.dto.ThemeDetailDto;
import com.ftm.app.api.dto.ThemeHistoryPointDto;
import com.ftm.app.api.dto.ThemeSummaryDto;
import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.CategoryType;
import com.ftm.app.domain.SignalType;
import com.ftm.app.domain.Theme;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.themes.repository.ThemeRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ThemeServiceTest {

  @Mock ThemeRepository themeRepository;
  @Mock CategoryRepository categoryRepository;
  @Mock SignalRepository signalRepository;
  @Mock AlertRepository alertRepository;
  @InjectMocks ThemeService themeService;

  private Theme theme(String id, String name) {
    return new Theme(id, name, "Test thesis", 1);
  }

  private Category category(CategoryId id, String name, String ticker) {
    return new Category(id, name, CategoryType.EQUITY_SECTOR, ticker, "XLK", 101, true, "TECH");
  }

  @Test
  @DisplayName("getThemes returns empty list when no themes exist")
  void shouldReturnEmptyWhenNoThemes() {
    when(themeRepository.findAll()).thenReturn(List.of());
    when(themeRepository.findAllConstituentsByTheme()).thenReturn(Map.of());
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc()).thenReturn(List.of());
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(Collections.emptyMap());

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("getThemes aggregates composite score as average of constituent scores")
  void shouldAggregateCompositeScoreAsAverage() {
    when(themeRepository.findAll()).thenReturn(List.of(theme("AI_INFRA", "AI Infrastructure")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("SEMI", "AIRO")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(
            List.of(
                category(CategoryId.SEMI, "Semiconductors", "SMH"),
                category(CategoryId.AIRO, "AI & Robotics", "BOTZ")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE,
                    Map.of("SEMI", new BigDecimal("0.80"), "AIRO", new BigDecimal("0.60")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result).hasSize(1);
    ThemeSummaryDto ai = result.get(0);
    assertThat(ai.id()).isEqualTo("AI_INFRA");
    assertThat(ai.constituentCount()).isEqualTo(2);
    assertThat(ai.compositeScore()).isCloseTo(0.70, org.assertj.core.data.Offset.offset(0.001));
  }

  @Test
  @DisplayName("getThemes computes BUY dominant signal when majority constituents are bullish")
  void shouldComputeBuyDominantSignalWhenMajorityBullish() {
    when(themeRepository.findAll()).thenReturn(List.of(theme("AI_INFRA", "AI Infrastructure")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("SEMI", "AIRO")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(
            List.of(
                category(CategoryId.SEMI, "Semiconductors", "SMH"),
                category(CategoryId.AIRO, "AI & Robotics", "BOTZ")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE,
                    Map.of("SEMI", new BigDecimal("0.80"), "AIRO", new BigDecimal("0.78")),
                SignalType.RRG_QUADRANT,
                    Map.of("SEMI", new BigDecimal("4"), "AIRO", new BigDecimal("4")),
                SignalType.COMPOSITE_TREND_20D,
                    Map.of("SEMI", new BigDecimal("0.02"), "AIRO", new BigDecimal("0.01")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result).hasSize(1);
    assertThat(result.get(0).dominantSignal()).isEqualTo("BUY");
    assertThat(result.get(0).bullishCount()).isEqualTo(2);
  }

  @Test
  @DisplayName("getTheme throws NoSuchElementException for unknown theme")
  void shouldThrowForUnknownTheme() {
    when(themeRepository.findAll()).thenReturn(List.of(theme("AI_INFRA", "AI Infrastructure")));

    assertThatThrownBy(() -> themeService.getTheme("UNKNOWN_THEME"))
        .isInstanceOf(NoSuchElementException.class)
        .hasMessageContaining("UNKNOWN_THEME");
  }

  @Test
  @DisplayName("getThemeHistory returns empty list when theme has no signal data")
  void shouldReturnEmptyHistoryWhenNoSignalsExist() {
    when(themeRepository.existsById("AI_INFRA")).thenReturn(true);
    when(themeRepository.findConstituentIds("AI_INFRA")).thenReturn(List.of("SEMI", "AIRO"));
    when(signalRepository.findAverageHistoryByDate(List.of("SEMI", "AIRO"), 30))
        .thenReturn(List.of());

    List<ThemeHistoryPointDto> result = themeService.getThemeHistory("AI_INFRA", 30);

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName(
      "getThemeHistory returns daily composite averages with trend data in chronological order")
  void shouldReturnChronologicalDailyAverages() {
    LocalDate day1 = LocalDate.of(2025, 1, 2);
    LocalDate day2 = LocalDate.of(2025, 1, 3);
    when(themeRepository.existsById("AI_INFRA")).thenReturn(true);
    when(themeRepository.findConstituentIds("AI_INFRA")).thenReturn(List.of("SEMI", "AIRO"));
    when(signalRepository.findAverageHistoryByDate(List.of("SEMI", "AIRO"), 30))
        .thenReturn(
            List.of(
                new SignalRepository.DateHistory(day1, 0.60, 0.005, 0.003),
                new SignalRepository.DateHistory(day2, 0.70, 0.012, 0.006)));

    List<ThemeHistoryPointDto> result = themeService.getThemeHistory("AI_INFRA", 30);

    assertThat(result).hasSize(2);
    assertThat(result.get(0).date()).isEqualTo("2025-01-02");
    assertThat(result.get(0).compositeScore()).isEqualTo(0.60);
    assertThat(result.get(0).trend5d()).isEqualTo(0.005);
    assertThat(result.get(1).date()).isEqualTo("2025-01-03");
    assertThat(result.get(1).compositeScore()).isEqualTo(0.70);
    assertThat(result.get(1).trend20d()).isEqualTo(0.006);
  }

  @Test
  @DisplayName("getThemeHistory throws NoSuchElementException for unknown theme")
  void shouldThrowForUnknownThemeHistory() {
    when(themeRepository.existsById("UNKNOWN")).thenReturn(false);

    assertThatThrownBy(() -> themeService.getThemeHistory("UNKNOWN", 30))
        .isInstanceOf(NoSuchElementException.class)
        .hasMessageContaining("UNKNOWN");
  }

  @Test
  @DisplayName("getTheme returns detail with all constituents sorted by composite score")
  void shouldReturnThemeDetailWithConstituentsSortedByScore() {
    when(themeRepository.findAll()).thenReturn(List.of(theme("AI_INFRA", "AI Infrastructure")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("SEMI", "AIRO")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(
            List.of(
                category(CategoryId.SEMI, "Semiconductors", "SMH"),
                category(CategoryId.AIRO, "AI & Robotics", "BOTZ")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE,
                    Map.of("SEMI", new BigDecimal("0.60"), "AIRO", new BigDecimal("0.80")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));

    ThemeDetailDto detail = themeService.getTheme("AI_INFRA");

    assertThat(detail.constituents()).hasSize(2);
    assertThat(detail.constituents().get(0).categoryId()).isEqualTo("AIRO");
    assertThat(detail.constituents().get(1).categoryId()).isEqualTo("SEMI");
  }

  @Test
  @DisplayName("getThemes computes compositeTrend5d as average of constituent 5d trend signals")
  void shouldAggregateCompositeTrend5d() {
    when(themeRepository.findAll()).thenReturn(List.of(theme("AI_INFRA", "AI Infrastructure")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("SEMI", "AIRO")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(
            List.of(
                category(CategoryId.SEMI, "Semiconductors", "SMH"),
                category(CategoryId.AIRO, "AI & Robotics", "BOTZ")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE,
                    Map.of("SEMI", new BigDecimal("0.80"), "AIRO", new BigDecimal("0.60")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D,
                    Map.of("SEMI", new BigDecimal("0.030"), "AIRO", new BigDecimal("0.010"))));

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result).hasSize(1);
    assertThat(result.get(0).compositeTrend5d())
        .isNotNull()
        .isCloseTo(0.020, org.assertj.core.data.Offset.offset(0.001));
  }

  @Test
  @DisplayName("getThemes sets parentCategoryId from category.parentId on each constituent")
  void shouldSetParentCategoryIdOnConstituents() {
    when(themeRepository.findAll()).thenReturn(List.of(theme("AI_INFRA", "AI Infrastructure")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("SEMI")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.SEMI, "Semiconductors", "SMH")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE, Map.of("SEMI", new BigDecimal("0.80")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result.get(0).topConstituents()).hasSize(1);
    assertThat(result.get(0).topConstituents().get(0).parentCategoryId()).isEqualTo("TECH");
  }
}
