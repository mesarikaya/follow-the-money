package com.ftm.app.alerts.evaluator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.instancio.Select.field;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.Severity;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.instancio.Instancio;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class HighConvictionAlertEvaluatorTest {

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final String BUY = "high_conviction_buy";
  private static final String CLUSTER = "high_conviction_cluster";
  private static final String REDUCE_CLUSTER = "high_conviction_reduce_cluster";

  @Mock AlertRulesRepository alertRulesRepository;
  @Mock SignalRepository signalRepository;
  @Mock AlertRepository alertRepository;

  private HighConvictionAlertEvaluator evaluator() {
    return new HighConvictionAlertEvaluator(
        alertRulesRepository, signalRepository, alertRepository);
  }

  private AlertEvaluationContext context(String... categoryIds) {
    Set<String> ids = Set.of(categoryIds);
    return new AlertEvaluationContext(DATE, ids, ids);
  }

  private AlertRule rule(String ruleId, boolean enabled, Severity severity) {
    return Instancio.of(AlertRule.class)
        .set(field(AlertRule::ruleId), ruleId)
        .set(field(AlertRule::enabled), enabled)
        .set(field(AlertRule::severity), severity)
        .create();
  }

  private void stubRules(boolean buy, boolean cluster, boolean reduceCluster) {
    lenient()
        .when(alertRulesRepository.findById(BUY))
        .thenReturn(Optional.of(rule(BUY, buy, Severity.ACTION)));
    lenient()
        .when(alertRulesRepository.findById(CLUSTER))
        .thenReturn(Optional.of(rule(CLUSTER, cluster, Severity.ACTION)));
    lenient()
        .when(alertRulesRepository.findById(REDUCE_CLUSTER))
        .thenReturn(Optional.of(rule(REDUCE_CLUSTER, reduceCluster, Severity.ACTION)));
  }

  /** Builds a latest-signal snapshot; each map is keyed by category. */
  private static class SnapshotBuilder {
    private final Map<SignalType, Map<String, BigDecimal>> byType = new HashMap<>();
    private final Map<String, BigDecimal> percentile = new HashMap<>();

    SnapshotBuilder put(SignalType type, String categoryId, String value) {
      byType.computeIfAbsent(type, t -> new HashMap<>()).put(categoryId, new BigDecimal(value));
      return this;
    }

    SnapshotBuilder percentile(String categoryId, String value) {
      percentile.put(categoryId, new BigDecimal(value));
      return this;
    }

    /** A sector whose conviction is a strong BUY (~83): score .85, RRG 4, +trend, macro .80. */
    SnapshotBuilder strongBuy(String categoryId) {
      return put(SignalType.COMPOSITE, categoryId, "0.85")
          .put(SignalType.RRG_QUADRANT, categoryId, "4")
          .put(SignalType.COMPOSITE_TREND_20D, categoryId, "0.05")
          .put(SignalType.MACRO_FIT, categoryId, "0.80")
          .percentile(categoryId, "0.90");
    }

    /** A sector whose conviction is a REDUCE (~43): score .30, RRG 1, -trend, macro .80. */
    SnapshotBuilder reduce(String categoryId) {
      return put(SignalType.COMPOSITE, categoryId, "0.30")
          .put(SignalType.RRG_QUADRANT, categoryId, "1")
          .put(SignalType.COMPOSITE_TREND_20D, categoryId, "-0.05")
          .put(SignalType.MACRO_FIT, categoryId, "0.80");
    }

    void install(SignalRepository repo) {
      when(repo.findLatestByTypes(any())).thenReturn(byType);
      lenient().when(repo.findScorePercentile252d()).thenReturn(percentile);
    }
  }

  @Test
  void createsNothingAndSkipsFetchWhenAllRulesDisabled() {
    stubRules(false, false, false);
    assertThat(evaluator().evaluate(context("TECH"))).isZero();
    verify(signalRepository, never()).findLatestByTypes(any());
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesBuyForHighConvictionSector() {
    stubRules(true, false, false);
    SnapshotBuilder snap = new SnapshotBuilder().strongBuy("TECH");
    snap.install(signalRepository);
    lenient().when(alertRepository.existsActiveAlert(BUY, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context("TECH"))).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void resolvesBuyWhenConvictionCollapsesAndAlertActive() {
    stubRules(true, false, false);
    // score .60 with RRG 0 and flat trend → HOLD → conviction 0 (< resolve threshold 65)
    SnapshotBuilder snap =
        new SnapshotBuilder()
            .put(SignalType.COMPOSITE, "TECH", "0.60")
            .put(SignalType.RRG_QUADRANT, "TECH", "0")
            .put(SignalType.COMPOSITE_TREND_20D, "TECH", "0.00");
    snap.install(signalRepository);
    when(alertRepository.existsActiveAlert(BUY, "TECH")).thenReturn(true);

    assertThat(evaluator().evaluate(context("TECH"))).isZero();
    verify(alertRepository).resolveAlertsByRuleAndCategory(BUY, "TECH");
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesClusterWhenThreeSectorsHighConviction() {
    stubRules(false, true, false);
    SnapshotBuilder snap =
        new SnapshotBuilder().strongBuy("TECH").strongBuy("ENRG").strongBuy("FINL");
    snap.install(signalRepository);
    when(alertRepository.existsActiveAlert(CLUSTER, null)).thenReturn(false);

    assertThat(evaluator().evaluate(context("TECH", "ENRG", "FINL"))).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void firesReduceClusterWhenThreeSectorsReduce() {
    stubRules(false, false, true);
    SnapshotBuilder snap = new SnapshotBuilder().reduce("TECH").reduce("ENRG").reduce("FINL");
    snap.install(signalRepository);
    when(alertRepository.existsActiveAlert(REDUCE_CLUSTER, null)).thenReturn(false);

    assertThat(evaluator().evaluate(context("TECH", "ENRG", "FINL"))).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void fetchesSnapshotOnceEvenWithAllThreeRulesEnabled() {
    stubRules(true, true, true);
    SnapshotBuilder snap = new SnapshotBuilder().strongBuy("TECH");
    snap.install(signalRepository);
    lenient().when(alertRepository.existsActiveAlert(any(), any())).thenReturn(false);
    lenient().when(alertRepository.existsActiveAlert(eq(CLUSTER), any())).thenReturn(false);

    evaluator().evaluate(context("TECH"));
    verify(signalRepository, times(1)).findLatestByTypes(any());
  }
}
