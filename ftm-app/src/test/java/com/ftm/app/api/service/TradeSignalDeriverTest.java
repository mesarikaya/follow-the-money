package com.ftm.app.api.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TradeSignalDeriverTest {

  @Test
  @DisplayName("returns null when composite score is null")
  void shouldReturnNullWhenScoreIsNull() {
    assertThat(TradeSignalDeriver.derive(null, "4", new BigDecimal("0.01"))).isNull();
  }

  @Test
  @DisplayName("returns BUY when score >= 0.65, quadrant improving (4), trend positive")
  void shouldReturnBuyWhenAllConditionsMet() {
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.75"), "4", new BigDecimal("0.02")))
        .isEqualTo("BUY");
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.65"), "3", new BigDecimal("0.01")))
        .isEqualTo("BUY");
  }

  @Test
  @DisplayName("returns WATCH when score >= 0.50 and improving quadrant, even if trend is negative")
  void shouldReturnWatchWhenScoreAndQuadrantMeetThreshold() {
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.60"), "4", new BigDecimal("-0.01")))
        .isEqualTo("WATCH");
  }

  @Test
  @DisplayName("returns WATCH when score >= 0.50 and trend positive, even if quadrant is lagging")
  void shouldReturnWatchWhenScoreAndTrendMeetThreshold() {
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.55"), "1", new BigDecimal("0.01")))
        .isEqualTo("WATCH");
  }

  @Test
  @DisplayName("returns REDUCE when score < 0.35 and quadrant is weakening (1 or 2)")
  void shouldReturnReduceWhenScoreLowAndQuadrantWeakening() {
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.30"), "1", null)).isEqualTo("REDUCE");
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.34"), "2", new BigDecimal("-0.02")))
        .isEqualTo("REDUCE");
  }

  @Test
  @DisplayName("returns HOLD when score is mid-range with no directional signal")
  void shouldReturnHoldForMidRangeScore() {
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.45"), "1", new BigDecimal("-0.01")))
        .isEqualTo("HOLD");
  }

  @Test
  @DisplayName("returns HOLD when score < 0.35 but quadrant is not weakening")
  void shouldReturnHoldWhenScoreLowButQuadrantImproving() {
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.30"), "4", null)).isEqualTo("HOLD");
  }

  @Test
  @DisplayName("returns BUY at exact 0.65 boundary with quadrant 3 and positive trend")
  void shouldReturnBuyAtExactBuyThreshold() {
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.65"), "3", new BigDecimal("0.001")))
        .isEqualTo("BUY");
  }

  @Test
  @DisplayName("does not return BUY when score is exactly 0.65 but trend is missing")
  void shouldNotReturnBuyWhenTrendMissing() {
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.65"), "3", null)).isEqualTo("WATCH");
  }

  @Test
  @DisplayName("handles null rrgQuadrant without throwing")
  void shouldHandleNullRrgQuadrant() {
    // score 0.60, no quadrant, trending — WATCH via trend
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.60"), null, new BigDecimal("0.01")))
        .isEqualTo("WATCH");
  }
}
