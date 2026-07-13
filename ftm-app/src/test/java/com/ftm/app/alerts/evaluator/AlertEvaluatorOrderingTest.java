package com.ftm.app.alerts.evaluator;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The engine runs the rules in {@code order()} sequence, and Spring decides the rest. Two rules
 * depend on that order because they read alerts written in the same pass; this pins both, so a
 * future rule cannot quietly land between them.
 */
class AlertEvaluatorOrderingTest {

  /** The rules whose alerts trade_signal_buy suppresses — they must not run before it. */
  private static final List<AlertEvaluator> READS_TRADE_SIGNAL_BUY =
      List.of(
          new PreBuyFlowSurgeAlertEvaluator(null, null, null),
          new ScoreApproachingSignalEvaluator(null, null, null),
          new SubSectorBreadthAlertEvaluator(null, null, null, null));

  private static final AlertEvaluator WRITES_TRADE_SIGNAL_BUY =
      new TradeSignalTransitionsAlertEvaluator(null, null, null);

  private static final AlertEvaluator COUNTS_EVERYTHING_ELSE =
      new MultiAlertBullConfluenceAlertEvaluator(null, null);

  @Test
  @DisplayName("the rule that writes trade_signal_buy runs before every rule that reads it")
  void writerRunsBeforeReaders() {
    READS_TRADE_SIGNAL_BUY.forEach(
        reader -> assertThat(WRITES_TRADE_SIGNAL_BUY.order()).isLessThan(reader.order()));
  }

  @Test
  @DisplayName("the bull-confluence meta-alert runs after every other rule")
  void metaAlertRunsLast() {
    List<AlertEvaluator> everyoneElse = new ArrayList<>(READS_TRADE_SIGNAL_BUY);
    everyoneElse.add(WRITES_TRADE_SIGNAL_BUY);

    everyoneElse.forEach(
        rule -> assertThat(COUNTS_EVERYTHING_ELSE.order()).isGreaterThan(rule.order()));
  }

  @Test
  @DisplayName("sorting by order() puts the writer first and the meta-alert last")
  void sortingHonoursBothDependencies() {
    List<AlertEvaluator> shuffled =
        new ArrayList<>(
            List.of(
                COUNTS_EVERYTHING_ELSE,
                READS_TRADE_SIGNAL_BUY.get(0),
                WRITES_TRADE_SIGNAL_BUY,
                READS_TRADE_SIGNAL_BUY.get(1)));

    List<AlertEvaluator> ordered =
        shuffled.stream().sorted(Comparator.comparingInt(AlertEvaluator::order)).toList();

    assertThat(ordered.get(0)).isSameAs(WRITES_TRADE_SIGNAL_BUY);
    assertThat(ordered.get(ordered.size() - 1)).isSameAs(COUNTS_EVERYTHING_ELSE);
  }

  @Test
  @DisplayName("a rule with no dependency does not pin an order")
  void independentRulesStayUnordered() {
    assertThat(new ScoreVelocityAlertEvaluator(null, null, null).order()).isZero();
  }
}
