package com.ftm.app.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.instancio.Select.field;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;

import com.ftm.app.api.dto.MacroResponse;
import com.ftm.app.api.repository.MacroIndicatorReadRepository;
import com.ftm.app.domain.MacroIndicator;
import com.ftm.app.signals.domain.MacroRegime;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.signals.repository.SignalRepository.MacroRegimeHistoryRow;
import com.ftm.app.signals.service.MacroRegimeService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.instancio.Instancio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MacroServiceTest {

  @Mock MacroIndicatorReadRepository macroIndicatorRepository;
  @Mock MacroRegimeService macroRegimeService;
  @Mock SignalRepository signalRepository;
  @InjectMocks MacroService macroService;

  private MacroIndicator indicator(String seriesId, BigDecimal value, LocalDate date) {
    return Instancio.of(MacroIndicator.class)
        .set(field(MacroIndicator::seriesId), seriesId)
        .set(field(MacroIndicator::value), value)
        .set(field(MacroIndicator::observationDate), date)
        .create();
  }

  private void stubDefaults(MacroRegime regime) {
    when(macroIndicatorRepository.findPreviousPerSeries(any())).thenReturn(List.of());
    when(signalRepository.findMacroRegimeHistory(anyInt())).thenReturn(List.of());
    when(macroRegimeService.computeMacroFitByCategory(regime)).thenReturn(Map.of());
  }

  @Test
  @DisplayName("getMacroResponse returns current regime and as-of date from latest indicator")
  void shouldReturnCurrentRegimeAndAsOfDate() {
    LocalDate today = LocalDate.now();
    MacroIndicator vix = indicator("VIXCLS", new BigDecimal("18.5"), today);
    MacroIndicator yieldCurve = indicator("T10Y2Y", new BigDecimal("-0.3"), today.minusDays(1));
    when(macroIndicatorRepository.findLatestPerSeries()).thenReturn(List.of(vix, yieldCurve));
    when(macroRegimeService.classifyCurrentRegime()).thenReturn(MacroRegime.RISK_ON_GROWTH);
    stubDefaults(MacroRegime.RISK_ON_GROWTH);

    MacroResponse response = macroService.getMacroResponse();

    assertThat(response.regime()).isEqualTo("RISK_ON_GROWTH");
    assertThat(response.asOfDate()).isEqualTo(today);
    assertThat(response.regimeHistory()).hasSize(1);
    assertThat(response.regimeHistory().get(0).regime()).isEqualTo("RISK_ON_GROWTH");
  }

  @Test
  @DisplayName("getMacroResponse uses today as fallback when no indicators available")
  void shouldUseTodayWhenNoIndicators() {
    when(macroIndicatorRepository.findLatestPerSeries()).thenReturn(List.of());
    when(macroRegimeService.classifyCurrentRegime()).thenReturn(MacroRegime.RISK_OFF_FLIGHT);
    stubDefaults(MacroRegime.RISK_OFF_FLIGHT);

    MacroResponse response = macroService.getMacroResponse();

    assertThat(response.asOfDate()).isEqualTo(LocalDate.now());
    assertThat(response.regime()).isEqualTo("RISK_OFF_FLIGHT");
  }

  @Test
  @DisplayName("getMacroResponse calls findPreviousPerSeries with the asOfDate from latest indicators")
  void shouldCallFindPreviousPerSeriesWithAsOfDate() {
    LocalDate today = LocalDate.now();
    MacroIndicator vix = indicator("VIXCLS", new BigDecimal("18.5"), today);
    when(macroIndicatorRepository.findLatestPerSeries()).thenReturn(List.of(vix));
    when(macroRegimeService.classifyCurrentRegime()).thenReturn(MacroRegime.RISK_ON_GROWTH);
    when(signalRepository.findMacroRegimeHistory(anyInt())).thenReturn(List.of());
    when(macroRegimeService.computeMacroFitByCategory(MacroRegime.RISK_ON_GROWTH)).thenReturn(Map.of());
    when(macroIndicatorRepository.findPreviousPerSeries(today)).thenReturn(List.of());

    macroService.getMacroResponse();

    // verify findPreviousPerSeries was called with the latest indicator's date
    verify(macroIndicatorRepository).findPreviousPerSeries(today);
  }

  @Test
  @DisplayName("getMacroResponse maps VIXCLS value to indicators dto")
  void shouldMapVixToIndicatorsDto() {
    LocalDate today = LocalDate.now();
    when(macroIndicatorRepository.findLatestPerSeries())
        .thenReturn(List.of(indicator("VIXCLS", new BigDecimal("22.1"), today)));
    when(macroRegimeService.classifyCurrentRegime()).thenReturn(MacroRegime.STAGFLATION);
    stubDefaults(MacroRegime.STAGFLATION);

    MacroResponse response = macroService.getMacroResponse();

    assertThat(response.indicators().vix()).isEqualByComparingTo("22.1");
  }

  @Test
  @DisplayName("getMacroResponse includes macroFitByCategory from MacroRegimeService")
  void shouldIncludeMacroFitByCategoryInResponse() {
    LocalDate today = LocalDate.now();
    when(macroIndicatorRepository.findLatestPerSeries())
        .thenReturn(List.of(indicator("VIXCLS", new BigDecimal("18.0"), today)));
    when(macroRegimeService.classifyCurrentRegime()).thenReturn(MacroRegime.RISK_ON_GROWTH);
    when(macroIndicatorRepository.findPreviousPerSeries(any())).thenReturn(List.of());
    when(signalRepository.findMacroRegimeHistory(anyInt())).thenReturn(List.of());
    when(macroRegimeService.computeMacroFitByCategory(MacroRegime.RISK_ON_GROWTH))
        .thenReturn(Map.of("TECH", new BigDecimal("0.78"), "UTIL", new BigDecimal("0.32")));

    MacroResponse response = macroService.getMacroResponse();

    assertThat(response.macroFitByCategory()).containsKey("TECH");
    assertThat(response.macroFitByCategory().get("TECH")).isEqualByComparingTo("0.78");
    assertThat(response.macroFitByCategory()).containsKey("UTIL");
  }

  @Test
  @DisplayName("getMacroResponse converts regime history ordinals to regime names")
  void shouldConvertRegimeHistoryOrdinalsToRegimeNames() {
    LocalDate today = LocalDate.now();
    when(macroIndicatorRepository.findLatestPerSeries())
        .thenReturn(List.of(indicator("VIXCLS", new BigDecimal("15.0"), today)));
    when(macroRegimeService.classifyCurrentRegime()).thenReturn(MacroRegime.RISK_ON_GROWTH);
    when(macroIndicatorRepository.findPreviousPerSeries(any())).thenReturn(List.of());
    when(macroRegimeService.computeMacroFitByCategory(MacroRegime.RISK_ON_GROWTH)).thenReturn(Map.of());
    when(signalRepository.findMacroRegimeHistory(anyInt())).thenReturn(List.of(
        new MacroRegimeHistoryRow(today.minusDays(7), new BigDecimal("1")),  // ordinal 1 = RISK_OFF_FLIGHT
        new MacroRegimeHistoryRow(today.minusDays(3), new BigDecimal("2")),  // ordinal 2 = RISK_ON_GROWTH
        new MacroRegimeHistoryRow(today,               new BigDecimal("3"))   // ordinal 3 = RISK_ON_DEFENSIVE
    ));

    MacroResponse response = macroService.getMacroResponse();

    assertThat(response.regimeHistory()).hasSize(3);
    assertThat(response.regimeHistory().get(0).regime()).isEqualTo("RISK_OFF_FLIGHT");
    assertThat(response.regimeHistory().get(1).regime()).isEqualTo("RISK_ON_GROWTH");
    assertThat(response.regimeHistory().get(2).regime()).isEqualTo("RISK_ON_DEFENSIVE");
  }

  @Test
  @DisplayName("getMacroResponse maps ordinal 0 to STAGFLATION in regime history")
  void shouldMapOrdinalZeroToStagflation() {
    LocalDate today = LocalDate.now();
    when(macroIndicatorRepository.findLatestPerSeries())
        .thenReturn(List.of(indicator("VIXCLS", new BigDecimal("25.0"), today)));
    when(macroRegimeService.classifyCurrentRegime()).thenReturn(MacroRegime.STAGFLATION);
    when(macroIndicatorRepository.findPreviousPerSeries(any())).thenReturn(List.of());
    when(macroRegimeService.computeMacroFitByCategory(MacroRegime.STAGFLATION)).thenReturn(Map.of());
    when(signalRepository.findMacroRegimeHistory(anyInt())).thenReturn(List.of(
        new MacroRegimeHistoryRow(today.minusDays(14), new BigDecimal("0"))  // ordinal 0 = STAGFLATION
    ));

    MacroResponse response = macroService.getMacroResponse();

    assertThat(response.regimeHistory()).hasSize(1);
    assertThat(response.regimeHistory().get(0).regime()).isEqualTo("STAGFLATION");
  }

  @Test
  @DisplayName("getMacroResponse maps unknown ordinal to UNKNOWN in regime history")
  void shouldMapUnknownOrdinalToUnknownString() {
    LocalDate today = LocalDate.now();
    when(macroIndicatorRepository.findLatestPerSeries())
        .thenReturn(List.of(indicator("VIXCLS", new BigDecimal("18.0"), today)));
    when(macroRegimeService.classifyCurrentRegime()).thenReturn(MacroRegime.RISK_ON_GROWTH);
    when(macroIndicatorRepository.findPreviousPerSeries(any())).thenReturn(List.of());
    when(macroRegimeService.computeMacroFitByCategory(MacroRegime.RISK_ON_GROWTH)).thenReturn(Map.of());
    when(signalRepository.findMacroRegimeHistory(anyInt())).thenReturn(List.of(
        new MacroRegimeHistoryRow(today.minusDays(5), new BigDecimal("99"))  // ordinal 99 = UNKNOWN
    ));

    MacroResponse response = macroService.getMacroResponse();

    assertThat(response.regimeHistory()).hasSize(1);
    assertThat(response.regimeHistory().get(0).regime()).isEqualTo("UNKNOWN");
  }

  @Test
  @DisplayName("getMacroResponse falls back to single-entry history when DB has no regime history")
  void shouldFallbackToCurrentRegimeWhenHistoryEmpty() {
    LocalDate today = LocalDate.now();
    when(macroIndicatorRepository.findLatestPerSeries())
        .thenReturn(List.of(indicator("VIXCLS", new BigDecimal("18.0"), today)));
    when(macroRegimeService.classifyCurrentRegime()).thenReturn(MacroRegime.STAGFLATION);
    when(macroIndicatorRepository.findPreviousPerSeries(any())).thenReturn(List.of());
    when(signalRepository.findMacroRegimeHistory(anyInt())).thenReturn(List.of());
    when(macroRegimeService.computeMacroFitByCategory(MacroRegime.STAGFLATION)).thenReturn(Map.of());

    MacroResponse response = macroService.getMacroResponse();

    assertThat(response.regimeHistory()).hasSize(1);
    assertThat(response.regimeHistory().get(0).regime()).isEqualTo("STAGFLATION");
  }
}
