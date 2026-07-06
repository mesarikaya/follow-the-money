package com.ftm.app.api.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MomentumTradeSignalDeriverTest {

  @Test
  @DisplayName("selected positive-momentum sector → BUY")
  void selectedPositiveIsBuy() {
    assertThat(MomentumTradeSignalDeriver.derive(new BigDecimal("0.14"), true)).isEqualTo("BUY");
  }

  @Test
  @DisplayName("positive momentum but not selected → HOLD")
  void positiveUnselectedIsHold() {
    assertThat(MomentumTradeSignalDeriver.derive(new BigDecimal("0.05"), false)).isEqualTo("HOLD");
  }

  @Test
  @DisplayName("negative momentum → REDUCE regardless of selection")
  void negativeIsReduce() {
    assertThat(MomentumTradeSignalDeriver.derive(new BigDecimal("-0.08"), true)).isEqualTo("REDUCE");
    assertThat(MomentumTradeSignalDeriver.derive(new BigDecimal("-0.08"), false))
        .isEqualTo("REDUCE");
  }

  @Test
  @DisplayName("zero momentum is not negative → HOLD when unselected")
  void zeroIsHold() {
    assertThat(MomentumTradeSignalDeriver.derive(BigDecimal.ZERO, false)).isEqualTo("HOLD");
  }

  @Test
  @DisplayName("null momentum → null (unavailable)")
  void nullMomentumIsNull() {
    assertThat(MomentumTradeSignalDeriver.derive(null, true)).isNull();
  }
}
