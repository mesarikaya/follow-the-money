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

  /** The position of a rule that must see what every other rule created. */
  int RUNS_LAST = Integer.MAX_VALUE;

  /**
   * @return the number of alerts this rule created during the pass (0 if its condition did not fire)
   */
  int evaluate(AlertEvaluationContext context);

  /**
   * Rules are independent of each other and run in no meaningful order — except the meta-alert that
   * counts the alerts the others have just created, which has to run after them.
   *
   * @return where this rule runs in the pass; lower goes first
   */
  default int order() {
    return 0;
  }
}
