package com.ftm.app.themes.snapshot;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.data.Offset.offset;

import com.ftm.app.api.dto.ThemeSnapshotDto;
import com.ftm.app.api.dto.ThemeSummaryDto;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ThemeSnapshotAggregatorTest {

  private ThemeSnapshotAggregator aggregator;

  @BeforeEach
  void setUp() {
    aggregator = new ThemeSnapshotAggregator();
  }

  private ThemeSummaryDto theme(
      String id,
      String dominantSignal,
      String themePhase,
      Double compositeScore,
      Double trend5d) {
    return new ThemeSummaryDto(
        id,
        "Theme " + id,
        "Thesis",
        3,
        compositeScore,
        null,
        null,
        trend5d,
        null,
        0,
        dominantSignal,
        null,
        themePhase,
        List.of(),
        0,
        0,
        0,
        null,
        null,
        null,
        null,
        "MEDIUM",
        null,
        null,
        null,
        50,
        "MODERATE",
        0,
        "F",
        0,
        "F");
  }

  @Test
  @DisplayName("empty list returns zero snapshot")
  void emptyListReturnsZeroSnapshot() {
    ThemeSnapshotDto snapshot = aggregator.aggregate(List.of());
    assertThat(snapshot.totalThemes()).isZero();
    assertThat(snapshot.buyCount()).isZero();
    assertThat(snapshot.averageCompositeScore()).isZero();
  }

  @Test
  @DisplayName("signal counts are correctly bucketed")
  void signalCountsAreCorrectlyBucketed() {
    List<ThemeSummaryDto> themes =
        List.of(
            theme("A", "BUY", "BREAKOUT", 0.75, 0.02),
            theme("B", "BUY", "MOMENTUM", 0.65, 0.01),
            theme("C", "WATCH", "BUILDING", 0.55, -0.01),
            theme("D", "HOLD", "BUILDING", 0.45, null),
            theme("E", "REDUCE", "FADING", 0.25, -0.03));

    ThemeSnapshotDto snapshot = aggregator.aggregate(themes);

    assertThat(snapshot.totalThemes()).isEqualTo(5);
    assertThat(snapshot.buyCount()).isEqualTo(2);
    assertThat(snapshot.watchCount()).isEqualTo(1);
    assertThat(snapshot.holdCount()).isEqualTo(1);
    assertThat(snapshot.reduceCount()).isEqualTo(1);
  }

  @Test
  @DisplayName("phase counts are correctly bucketed")
  void phaseCountsAreCorrectlyBucketed() {
    List<ThemeSummaryDto> themes =
        List.of(
            theme("A", "BUY", "BREAKOUT", 0.75, null),
            theme("B", "BUY", "MOMENTUM", 0.65, null),
            theme("C", "WATCH", "BUILDING", 0.55, null),
            theme("D", "HOLD", "FADING", 0.45, null),
            theme("E", "REDUCE", "WEAK", 0.20, null));

    ThemeSnapshotDto snapshot = aggregator.aggregate(themes);

    assertThat(snapshot.breakoutCount()).isEqualTo(1);
    assertThat(snapshot.momentumCount()).isEqualTo(1);
    assertThat(snapshot.buildingCount()).isEqualTo(1);
    assertThat(snapshot.fadingCount()).isEqualTo(1);
    assertThat(snapshot.weakCount()).isEqualTo(1);
  }

  @Test
  @DisplayName("average composite score is computed correctly")
  void averageCompositeScoreIsComputedCorrectly() {
    List<ThemeSummaryDto> themes =
        List.of(
            theme("A", "BUY", "BREAKOUT", 0.80, null),
            theme("B", "WATCH", "BUILDING", 0.60, null),
            theme("C", "HOLD", "FADING", 0.40, null));

    ThemeSnapshotDto snapshot = aggregator.aggregate(themes);

    assertThat(snapshot.averageCompositeScore()).isCloseTo(0.60, offset(0.001));
  }

  @Test
  @DisplayName("momentum counts reflect positive and negative 5d trends")
  void momentumCountsReflectTrends() {
    List<ThemeSummaryDto> themes =
        List.of(
            theme("A", "BUY", "BREAKOUT", 0.75, 0.05),
            theme("B", "BUY", "MOMENTUM", 0.65, 0.02),
            theme("C", "WATCH", "BUILDING", 0.55, -0.01),
            theme("D", "HOLD", "FADING", 0.45, null));

    ThemeSnapshotDto snapshot = aggregator.aggregate(themes);

    assertThat(snapshot.gainingMomentumCount()).isEqualTo(2);
    assertThat(snapshot.losingMomentumCount()).isEqualTo(1);
  }

  @Test
  @DisplayName("null signal and phase fields are ignored without exception")
  void nullFieldsAreIgnoredSafely() {
    ThemeSummaryDto themeWithNulls = theme("A", null, null, null, null);
    ThemeSnapshotDto snapshot = aggregator.aggregate(List.of(themeWithNulls));

    assertThat(snapshot.totalThemes()).isEqualTo(1);
    assertThat(snapshot.buyCount()).isZero();
    assertThat(snapshot.breakoutCount()).isZero();
    assertThat(snapshot.averageCompositeScore()).isZero();
    assertThat(snapshot.gainingMomentumCount()).isZero();
    assertThat(snapshot.losingMomentumCount()).isZero();
  }
}
