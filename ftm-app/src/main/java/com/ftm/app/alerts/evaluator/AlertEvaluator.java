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
   * @return the number of alerts this rule created during the pass (0 if its condition did not fire)
   */
  int evaluate(AlertEvaluationContext context);
}
