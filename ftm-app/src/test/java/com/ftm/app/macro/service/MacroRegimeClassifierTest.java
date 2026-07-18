package com.ftm.app.macro.service;

import static com.ftm.app.signals.domain.MacroRegime.RISK_OFF_FLIGHT;
import static com.ftm.app.signals.domain.MacroRegime.RISK_ON_DEFENSIVE;
import static com.ftm.app.signals.domain.MacroRegime.RISK_ON_GROWTH;
import static com.ftm.app.signals.domain.MacroRegime.STAGFLATION;
import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MacroRegimeClassifierTest {

  private final MacroRegimeClassifier classifier = new MacroRegimeClassifier();

  private static BigDecimal bd(String val) {
    return new BigDecimal(val);
  }

  @Test
  @DisplayName("classifies STAGFLATION when yield steep AND breakeven above 2.5")
  void shouldClassifyStagflation() {
    assertThat(classifier.classify(bd("0.5"), bd("18"), bd("2.8"))).isEqualTo(STAGFLATION);
  }

  @Test
  @DisplayName("classifies RISK_OFF_FLIGHT when VIX above 25 (regardless of yield)")
  void shouldClassifyRiskOffFlightOnHighVix() {
    assertThat(classifier.classify(bd("0.4"), bd("30"), bd("2.0"))).isEqualTo(RISK_OFF_FLIGHT);
  }

  @Test
  @DisplayName("classifies RISK_OFF_FLIGHT when yield deeply inverted below -0.2")
  void shouldClassifyRiskOffFlightOnInvertedYield() {
    assertThat(classifier.classify(bd("-0.5"), bd("18"), bd("2.0"))).isEqualTo(RISK_OFF_FLIGHT);
  }

  @Test
  @DisplayName("classifies RISK_ON_DEFENSIVE when yield flat (<0.3) and VIX calm (<22)")
  void shouldClassifyRiskOnDefensive() {
    assertThat(classifier.classify(bd("0.1"), bd("15"), bd("2.0"))).isEqualTo(RISK_ON_DEFENSIVE);
  }

  @Test
  @DisplayName("classifies RISK_ON_GROWTH when yield steep (>0.3) and VIX calm (<22)")
  void shouldClassifyRiskOnGrowth() {
    assertThat(classifier.classify(bd("0.5"), bd("18"), bd("2.0"))).isEqualTo(RISK_ON_GROWTH);
  }

  @Test
  @DisplayName("falls back to RISK_ON_GROWTH when all indicators are null")
  void shouldFallbackToRiskOnGrowthWhenAllNull() {
    assertThat(classifier.classify(null, null, null)).isEqualTo(RISK_ON_GROWTH);
  }

  @Test
  @DisplayName("STAGFLATION has higher priority than RISK_OFF_FLIGHT when VIX also above 25")
  void stagflationTakesPriorityOverRiskOff() {
    // T10Y2Y=0.5>0.3, breakeven=2.8>2.5 → STAGFLATION even if VIX=26>25
    assertThat(classifier.classify(bd("0.5"), bd("26"), bd("2.8"))).isEqualTo(STAGFLATION);
  }

  @Test
  @DisplayName("RISK_OFF_FLIGHT wins when only VIX is elevated (breakeven below 2.5)")
  void riskOffFlightWhenOnlyVixElevated() {
    assertThat(classifier.classify(bd("0.4"), bd("26"), bd("2.0"))).isEqualTo(RISK_OFF_FLIGHT);
  }
}
