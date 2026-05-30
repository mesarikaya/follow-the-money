package com.ftm.app.signals.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ftm.app.api.repository.MacroIndicatorReadRepository;
import com.ftm.app.domain.MacroIndicator;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.domain.MacroRegime;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MacroRegimeServiceTest {

  @Mock MacroIndicatorReadRepository macroIndicatorRepository;
  @Mock SignalRepository signalRepository;
  @Mock MacroRegimeClassifier regimeClassifier;

  MacroRegimeService service;

  private static final LocalDate DATE_A = LocalDate.of(2023, 3, 1);
  private static final LocalDate DATE_B = LocalDate.of(2023, 6, 1);
  private static final LocalDate DATE_C = LocalDate.of(2023, 9, 1);

  @BeforeEach
  void setUp() {
    service = new MacroRegimeService(macroIndicatorRepository, signalRepository, regimeClassifier);
  }

  private MacroIndicator indicator(LocalDate date, String seriesId, double value) {
    return new MacroIndicator(date, seriesId, BigDecimal.valueOf(value), "FRED");
  }

  // ===== classifyCurrentRegime =====

  @Test
  @DisplayName("classifyCurrentRegime delegates to regimeClassifier with latest FRED values")
  void shouldDelegateToRegimeClassifierWithLatestValues() {
    when(macroIndicatorRepository.findLatestPerSeries()).thenReturn(List.of(
        indicator(DATE_A, "T10Y2Y", 0.5),
        indicator(DATE_A, "VIXCLS", 18.0),
        indicator(DATE_A, "T10YIE", 2.1)));
    when(regimeClassifier.classify(any(), any(), any())).thenReturn(MacroRegime.RISK_ON_GROWTH);

    MacroRegime result = service.classifyCurrentRegime();

    assertThat(result).isEqualTo(MacroRegime.RISK_ON_GROWTH);
    verify(regimeClassifier).classify(
        new BigDecimal("0.5"), new BigDecimal("18.0"), new BigDecimal("2.1"));
  }

  @Test
  @DisplayName("classifyCurrentRegime passes null for missing FRED series")
  void shouldPassNullForMissingFredSeries() {
    when(macroIndicatorRepository.findLatestPerSeries()).thenReturn(List.of(
        indicator(DATE_A, "T10Y2Y", 0.5)));
    when(regimeClassifier.classify(any(), any(), any())).thenReturn(MacroRegime.STAGFLATION);

    service.classifyCurrentRegime();

    verify(regimeClassifier).classify(new BigDecimal("0.5"), null, null);
  }

  // ===== computeMacroFitByCategory =====

  @Test
  @DisplayName("computeMacroFitByCategory returns empty map when no historical indicators exist")
  void shouldReturnEmptyWhenNoHistoricalIndicators() {
    when(macroIndicatorRepository.findHistoricalForSeries(any(), any())).thenReturn(List.of());

    Map<String, BigDecimal> result = service.computeMacroFitByCategory(MacroRegime.RISK_ON_GROWTH);

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("computeMacroFitByCategory returns empty map when no historical date matches the regime")
  void shouldReturnEmptyWhenNoDateMatchesRegime() {
    when(macroIndicatorRepository.findHistoricalForSeries(any(), any())).thenReturn(List.of(
        indicator(DATE_A, "T10Y2Y", 0.5),
        indicator(DATE_A, "VIXCLS", 18.0),
        indicator(DATE_A, "T10YIE", 2.1)));
    when(regimeClassifier.classify(any(), any(), any())).thenReturn(MacroRegime.STAGFLATION);

    Map<String, BigDecimal> result = service.computeMacroFitByCategory(MacroRegime.RISK_ON_GROWTH);

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("computeMacroFitByCategory computes 100% win rate when RS_60 is always positive")
  void shouldReturnOneHundredPercentWhenRsAlwaysPositive() {
    when(macroIndicatorRepository.findHistoricalForSeries(any(), any())).thenReturn(List.of(
        indicator(DATE_A, "T10Y2Y", 0.5),
        indicator(DATE_A, "VIXCLS", 18.0),
        indicator(DATE_A, "T10YIE", 2.1)));
    when(regimeClassifier.classify(any(), any(), any())).thenReturn(MacroRegime.RISK_ON_GROWTH);
    when(signalRepository.findByTypeForDates(eq(SignalType.RS_60), any()))
        .thenReturn(Map.of(DATE_A, Map.of("TECH", new BigDecimal("0.050"))));

    Map<String, BigDecimal> result = service.computeMacroFitByCategory(MacroRegime.RISK_ON_GROWTH);

    assertThat(result).containsKey("TECH");
    assertThat(result.get("TECH").compareTo(BigDecimal.ONE)).isEqualTo(0);
  }

  @Test
  @DisplayName("computeMacroFitByCategory computes 0% win rate when RS_60 is always negative")
  void shouldReturnZeroWhenRsAlwaysNegative() {
    when(macroIndicatorRepository.findHistoricalForSeries(any(), any())).thenReturn(List.of(
        indicator(DATE_A, "T10Y2Y", 0.5),
        indicator(DATE_A, "VIXCLS", 18.0),
        indicator(DATE_A, "T10YIE", 2.1)));
    when(regimeClassifier.classify(any(), any(), any())).thenReturn(MacroRegime.RISK_ON_GROWTH);
    when(signalRepository.findByTypeForDates(eq(SignalType.RS_60), any()))
        .thenReturn(Map.of(DATE_A, Map.of("TECH", new BigDecimal("-0.020"))));

    Map<String, BigDecimal> result = service.computeMacroFitByCategory(MacroRegime.RISK_ON_GROWTH);

    assertThat(result).containsKey("TECH");
    assertThat(result.get("TECH").compareTo(BigDecimal.ZERO)).isEqualTo(0);
  }

  @Test
  @DisplayName("computeMacroFitByCategory computes 50% win rate when RS_60 is positive half the time")
  void shouldReturnFiftyPercentWhenRsPositiveHalfTheTime() {
    when(macroIndicatorRepository.findHistoricalForSeries(any(), any())).thenReturn(List.of(
        indicator(DATE_A, "T10Y2Y", 0.5), indicator(DATE_A, "VIXCLS", 18.0), indicator(DATE_A, "T10YIE", 2.1),
        indicator(DATE_B, "T10Y2Y", 0.6), indicator(DATE_B, "VIXCLS", 17.0), indicator(DATE_B, "T10YIE", 2.0)));
    when(regimeClassifier.classify(any(), any(), any())).thenReturn(MacroRegime.RISK_ON_GROWTH);
    when(signalRepository.findByTypeForDates(eq(SignalType.RS_60), any()))
        .thenReturn(Map.of(
            DATE_A, Map.of("TECH", new BigDecimal("0.030")),  // positive
            DATE_B, Map.of("TECH", new BigDecimal("-0.010"))  // negative
        ));

    Map<String, BigDecimal> result = service.computeMacroFitByCategory(MacroRegime.RISK_ON_GROWTH);

    assertThat(result).containsKey("TECH");
    assertThat(result.get("TECH")).isEqualByComparingTo(new BigDecimal("0.500000"));
  }

  @Test
  @DisplayName("computeMacroFitByCategory skips dates where a required FRED series is missing")
  void shouldSkipDatesWithMissingFredSeries() {
    // DATE_A has all three series, DATE_B is missing VIXCLS — should be excluded
    when(macroIndicatorRepository.findHistoricalForSeries(any(), any())).thenReturn(List.of(
        indicator(DATE_A, "T10Y2Y", 0.5), indicator(DATE_A, "VIXCLS", 18.0), indicator(DATE_A, "T10YIE", 2.1),
        indicator(DATE_B, "T10Y2Y", 0.6), indicator(DATE_B, "T10YIE", 2.0)));
    when(regimeClassifier.classify(any(), any(), any())).thenReturn(MacroRegime.RISK_ON_GROWTH);
    when(signalRepository.findByTypeForDates(eq(SignalType.RS_60), any()))
        .thenReturn(Map.of(
            DATE_A, Map.of("TECH", new BigDecimal("-0.010"))
        ));

    Map<String, BigDecimal> result = service.computeMacroFitByCategory(MacroRegime.RISK_ON_GROWTH);

    // Only DATE_A counted (1 negative day) → 0% win rate; DATE_B excluded due to missing series
    assertThat(result.get("TECH")).isEqualByComparingTo(BigDecimal.ZERO);
  }

  @Test
  @DisplayName("computeMacroFitByCategory handles multiple categories independently")
  void shouldHandleMultipleCategoriesIndependently() {
    when(macroIndicatorRepository.findHistoricalForSeries(any(), any())).thenReturn(List.of(
        indicator(DATE_A, "T10Y2Y", 0.5), indicator(DATE_A, "VIXCLS", 18.0), indicator(DATE_A, "T10YIE", 2.1),
        indicator(DATE_B, "T10Y2Y", 0.6), indicator(DATE_B, "VIXCLS", 17.0), indicator(DATE_B, "T10YIE", 2.0)));
    when(regimeClassifier.classify(any(), any(), any())).thenReturn(MacroRegime.RISK_ON_GROWTH);
    when(signalRepository.findByTypeForDates(eq(SignalType.RS_60), any()))
        .thenReturn(Map.of(
            DATE_A, Map.of("TECH", new BigDecimal("0.080"), "UTIL", new BigDecimal("-0.030")),
            DATE_B, Map.of("TECH", new BigDecimal("0.050"), "UTIL", new BigDecimal("-0.020"))
        ));

    Map<String, BigDecimal> result = service.computeMacroFitByCategory(MacroRegime.RISK_ON_GROWTH);

    assertThat(result.get("TECH")).isEqualByComparingTo(BigDecimal.ONE);   // 2/2 = 100%
    assertThat(result.get("UTIL")).isEqualByComparingTo(BigDecimal.ZERO);  // 0/2 = 0%
  }

  @Test
  @DisplayName("computeMacroFitByCategory ignores dates where regime differs from current")
  void shouldIgnoreDatesWhereRegimeDiffers() {
    when(macroIndicatorRepository.findHistoricalForSeries(any(), any())).thenReturn(List.of(
        indicator(DATE_A, "T10Y2Y", 0.5), indicator(DATE_A, "VIXCLS", 18.0), indicator(DATE_A, "T10YIE", 2.1),
        indicator(DATE_B, "T10Y2Y", -0.5), indicator(DATE_B, "VIXCLS", 35.0), indicator(DATE_B, "T10YIE", 2.5)));
    // DATE_A → RISK_ON_GROWTH, DATE_B → RISK_OFF_FLIGHT
    when(regimeClassifier.classify(new BigDecimal("0.5"), new BigDecimal("18.0"), new BigDecimal("2.1")))
        .thenReturn(MacroRegime.RISK_ON_GROWTH);
    when(regimeClassifier.classify(new BigDecimal("-0.5"), new BigDecimal("35.0"), new BigDecimal("2.5")))
        .thenReturn(MacroRegime.RISK_OFF_FLIGHT);
    when(signalRepository.findByTypeForDates(eq(SignalType.RS_60), any()))
        .thenReturn(Map.of(
            DATE_A, Map.of("TECH", new BigDecimal("0.040"))   // positive on RISK_ON_GROWTH day
        ));

    Map<String, BigDecimal> result = service.computeMacroFitByCategory(MacroRegime.RISK_ON_GROWTH);

    // Only DATE_A matches RISK_ON_GROWTH, DATE_B is a different regime → 1/1 = 100%
    assertThat(result.get("TECH")).isEqualByComparingTo(BigDecimal.ONE);
  }
}
