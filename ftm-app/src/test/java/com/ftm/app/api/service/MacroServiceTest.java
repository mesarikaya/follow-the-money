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
}
