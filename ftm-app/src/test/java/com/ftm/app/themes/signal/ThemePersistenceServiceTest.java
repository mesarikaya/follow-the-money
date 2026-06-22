package com.ftm.app.themes.signal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.ftm.app.signals.repository.SignalRepository.DateHistory;
import com.ftm.app.themes.signal.ThemePersistenceService.ThemePersistence;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ThemePersistenceServiceTest {

  @Mock ThemePhaseHistoryService themePhaseHistoryService;
  @InjectMocks ThemePersistenceService persistenceService;

  private DateHistory day(double composite) {
    return new DateHistory(LocalDate.now(), composite, 0.0, 0.0);
  }

  @Test
  @DisplayName("empty history returns score 0 and grade F")
  void emptyHistoryReturnsZeroF() {
    ThemePersistence result = persistenceService.computePersistence(List.of());

    assertThat(result.persistenceScore()).isEqualTo(0);
    assertThat(result.persistenceGrade()).isEqualTo("F");
  }

  @Test
  @DisplayName("all strong phases returns score 100 and grade A")
  void allStrongPhasesReturnsHundredA() {
    List<DateHistory> history = List.of(day(0.8), day(0.7), day(0.65));
    when(themePhaseHistoryService.computeHistory(history))
        .thenReturn(List.of("BREAKOUT", "MOMENTUM", "SETUP"));

    ThemePersistence result = persistenceService.computePersistence(history);

    assertThat(result.persistenceScore()).isEqualTo(100);
    assertThat(result.persistenceGrade()).isEqualTo("A");
  }

  @Test
  @DisplayName("no strong phases returns score 0 and grade F")
  void noStrongPhasesReturnsZeroF() {
    List<DateHistory> history = List.of(day(0.3), day(0.4));
    when(themePhaseHistoryService.computeHistory(history))
        .thenReturn(List.of("NEUTRAL", "FADING"));

    ThemePersistence result = persistenceService.computePersistence(history);

    assertThat(result.persistenceScore()).isEqualTo(0);
    assertThat(result.persistenceGrade()).isEqualTo("F");
  }

  @Test
  @DisplayName("60% strong phases returns score 60 and grade B")
  void sixtyPercentStrongReturnsGradeB() {
    List<DateHistory> history = List.of(day(0.7), day(0.7), day(0.7), day(0.3), day(0.3));
    when(themePhaseHistoryService.computeHistory(history))
        .thenReturn(List.of("BREAKOUT", "MOMENTUM", "SETUP", "NEUTRAL", "FADING"));

    ThemePersistence result = persistenceService.computePersistence(history);

    assertThat(result.persistenceScore()).isEqualTo(60);
    assertThat(result.persistenceGrade()).isEqualTo("B");
  }

  @Test
  @DisplayName("20% strong phases returns score 20 and grade D")
  void twentyPercentStrongReturnsGradeD() {
    List<DateHistory> history = List.of(day(0.7), day(0.3), day(0.3), day(0.3), day(0.3));
    when(themePhaseHistoryService.computeHistory(history))
        .thenReturn(List.of("BREAKOUT", "NEUTRAL", "FADING", "WEAK", "HOLDING"));

    ThemePersistence result = persistenceService.computePersistence(history);

    assertThat(result.persistenceScore()).isEqualTo(20);
    assertThat(result.persistenceGrade()).isEqualTo("D");
  }

  @Test
  @DisplayName("40% strong phases returns score 40 and grade C")
  void fortyPercentStrongReturnsGradeC() {
    List<DateHistory> history = List.of(day(0.7), day(0.7), day(0.3), day(0.3), day(0.3));
    when(themePhaseHistoryService.computeHistory(history))
        .thenReturn(List.of("BREAKOUT", "SETUP", "NEUTRAL", "HOLDING", "FADING"));

    ThemePersistence result = persistenceService.computePersistence(history);

    assertThat(result.persistenceScore()).isEqualTo(40);
    assertThat(result.persistenceGrade()).isEqualTo("C");
  }

  @Test
  @DisplayName("80% strong phases returns score 80 and grade A")
  void eightyPercentStrongReturnsGradeA() {
    List<DateHistory> history = List.of(day(0.8), day(0.8), day(0.8), day(0.8), day(0.3));
    when(themePhaseHistoryService.computeHistory(history))
        .thenReturn(List.of("BREAKOUT", "MOMENTUM", "SETUP", "BREAKOUT", "NEUTRAL"));

    ThemePersistence result = persistenceService.computePersistence(history);

    assertThat(result.persistenceScore()).isEqualTo(80);
    assertThat(result.persistenceGrade()).isEqualTo("A");
  }
}
