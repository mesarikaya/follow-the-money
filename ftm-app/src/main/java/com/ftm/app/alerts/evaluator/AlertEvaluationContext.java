package com.ftm.app.alerts.evaluator;

import java.time.LocalDate;
import java.util.Set;

/**
 * The shared inputs every alert rule needs for one evaluation pass: the signal date being evaluated
 * and the category-id sets it may act on. Computed once by the engine and handed to each
 * {@link AlertEvaluator}, so a rule never has to re-derive them.
 */
public record AlertEvaluationContext(
    LocalDate signalDate, Set<String> topLevelCategoryIds, Set<String> equityCategoryIds) {}
