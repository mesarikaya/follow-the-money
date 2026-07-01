package com.ftm.app.themes.correlation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

import com.ftm.app.api.dto.ThemeCorrelationDto;
import com.ftm.app.domain.Theme;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.signals.repository.SignalRepository.DateHistory;
import com.ftm.app.themes.repository.ThemeRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ThemeSignalCorrelationServiceTest {

  @Mock ThemeRepository themeRepository;
  @Mock SignalRepository signalRepository;
  @InjectMocks ThemeSignalCorrelationService service;

  private static final Theme THEME_A = new Theme("THEME_A", "Theme Alpha", "Thesis A", 1);
  private static final Theme THEME_B = new Theme("THEME_B", "Theme Beta", "Thesis B", 2);

  @BeforeEach
  void setUp() {
    when(themeRepository.findAll()).thenReturn(List.of(THEME_A, THEME_B));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("THEME_A", List.of("CAT1"), "THEME_B", List.of("CAT2")));
  }

  private static DateHistory day(LocalDate date, double score) {
    return new DateHistory(date, score, null, null);
  }

  @Test
  @DisplayName("matrix is 2×2 for two themes and diagonal is 1.0")
  void matrixDimensionsAndDiagonal() {
    when(signalRepository.findAverageHistoryByDate(anyList(), anyInt()))
        .thenReturn(List.of(
            day(LocalDate.of(2026, 1, 1), 0.60),
            day(LocalDate.of(2026, 1, 2), 0.62),
            day(LocalDate.of(2026, 1, 3), 0.64)));

    ThemeCorrelationDto result = service.compute(60);

    assertThat(result.matrix().length).isEqualTo(2);
    assertThat(result.matrix()[0].length).isEqualTo(2);
    assertThat(result.matrix()[0][0]).isEqualTo(1.0);
    assertThat(result.matrix()[1][1]).isEqualTo(1.0);
  }

  @Test
  @DisplayName("matrix is symmetric: r(A,B) == r(B,A)")
  void matrixIsSymmetric() {
    when(signalRepository.findAverageHistoryByDate(anyList(), anyInt()))
        .thenReturn(List.of(
            day(LocalDate.of(2026, 1, 1), 0.60),
            day(LocalDate.of(2026, 1, 2), 0.62),
            day(LocalDate.of(2026, 1, 3), 0.58)));

    ThemeCorrelationDto result = service.compute(60);

    assertThat(result.matrix()[0][1]).isEqualTo(result.matrix()[1][0]);
  }

  @Test
  @DisplayName("identical score histories produce r=1.0 off-diagonal")
  void identicalHistoriesProduceOneOffDiagonal() {
    List<DateHistory> sharedHistory = List.of(
        day(LocalDate.of(2026, 1, 1), 0.50),
        day(LocalDate.of(2026, 1, 2), 0.55),
        day(LocalDate.of(2026, 1, 3), 0.52),
        day(LocalDate.of(2026, 1, 4), 0.58));
    when(signalRepository.findAverageHistoryByDate(anyList(), anyInt())).thenReturn(sharedHistory);

    ThemeCorrelationDto result = service.compute(60);

    assertThat(result.matrix()[0][1]).isCloseTo(1.0, within(1e-9));
  }

  @Test
  @DisplayName("returns themeIds and themeNames matching theme list")
  void returnsCorrectThemeMeta() {
    when(signalRepository.findAverageHistoryByDate(anyList(), anyInt())).thenReturn(List.of());

    ThemeCorrelationDto result = service.compute(60);

    assertThat(result.themeIds()).containsExactly("THEME_A", "THEME_B");
    assertThat(result.themeNames()).containsExactly("Theme Alpha", "Theme Beta");
  }

  @Test
  @DisplayName("empty history produces 0.0 off-diagonal without throwing")
  void emptyHistoryProducesZeroOffDiagonal() {
    when(signalRepository.findAverageHistoryByDate(anyList(), anyInt())).thenReturn(List.of());

    ThemeCorrelationDto result = service.compute(60);

    assertThat(result.matrix()[0][1]).isEqualTo(0.0);
    assertThat(result.matrix()[1][0]).isEqualTo(0.0);
  }
}
