package com.ftm.app.alerts.evaluator;

/**
 * One alert rule. Each implementation checks a single condition against the {@link
 * AlertEvaluationContext}, creates any alerts it wants, and returns how many it created.
 *
 * <p>Extracting rules to this interface lets the engine own only the orchestration ("run every
 * rule") while each rule lives in its own small, independently-testable class (Open/Closed: adding a
 * rule is a new file, not another branch in a 3,000-line method).
 */
public interface AlertEvaluator {

  /**
   * The position of a rule whose alerts other rules read within the same pass. Only
   * {@code trade_signal_buy} is such a rule: three others suppress themselves when it has fired, so
   * it has to fire first.
   */
  int RUNS_FIRST = Integer.MIN_VALUE;

  /** The position of a rule that must see what every other rule created. */
  int RUNS_LAST = Integer.MAX_VALUE;

  /**
   * @return the number of alerts this rule created during the pass (0 if its condition did not fire)
   */
  int evaluate(AlertEvaluationContext context);

  /**
   * Rules are independent of each other and run in no meaningful order — with two exceptions, and
   * both of them are read-after-write inside a single pass: a rule whose alerts others check must
   * run before them ({@link #RUNS_FIRST}), and the meta-alert that counts what everything else
   * created must run after them ({@link #RUNS_LAST}). Pin an order only for a real dependency like
   * those; the rest genuinely do not care.
   *
   * @return where this rule runs in the pass; lower goes first
   */
  default int order() {
    return 0;
  }
}
