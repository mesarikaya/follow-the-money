package com.ftm.app.alerts.evaluator;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.AlertStatus;
import com.ftm.app.domain.Severity;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.themes.repository.ThemeRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalDouble;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Fires per theme when its constituents are strong (composite in BUY territory) but institutional
 * flow has turned sharply negative — i.e. smart money is distributing into strength. Resolves when
 * flow recovers.
 */
@Component
public class ThemeDistributeWarningAlertEvaluator implements AlertEvaluator {

  private static final Logger log =
      LoggerFactory.getLogger(ThemeDistributeWarningAlertEvaluator.class);

  private static final String RULE_THEME_DISTRIBUTE_WARNING = "theme_distribute_warning";
  private static final double THEME_DISTRIBUTE_SCORE_THRESHOLD = 0.65;
  private static final double THEME_DISTRIBUTE_FLOW_THRESHOLD = -0.5;
  private static final double THEME_DISTRIBUTE_FLOW_RESOLVE = 0.0;

  private final AlertRulesRepository alertRulesRepository;
  private final ThemeRepository themeRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public ThemeDistributeWarningAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      ThemeRepository themeRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.themeRepository = themeRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_DISTRIBUTE_WARNING);
    if (!rule.map(AlertRule::enabled).orElse(false)) {
      return 0;
    }

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> composite =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> flow = signalRepository.findByTypeAndDate(SignalType.FLOW_20D, signalDate);
    if (constituentsByTheme.isEmpty() || composite.isEmpty() || flow.isEmpty()) {
      return 0;
    }

    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);
    List<Distribution> distributions =
        constituentsByTheme.entrySet().stream()
            .map(entry -> assess(entry.getKey(), entry.getValue(), composite, flow))
            .flatMap(Optional::stream)
            .toList();

    distributions.stream()
        .filter(Distribution::shouldFire)
        .forEach(d -> fire(d, severity, signalDate));
    distributions.stream().filter(Distribution::shouldResolve).forEach(this::resolve);
    return (int) distributions.stream().filter(Distribution::shouldFire).count();
  }

  private Optional<Distribution> assess(
      String themeId,
      List<String> constituentIds,
      Map<String, BigDecimal> composite,
      Map<String, BigDecimal> flow) {
    if (constituentIds.isEmpty()) {
      return Optional.empty();
    }
    OptionalDouble avgComposite = averageOf(constituentIds, composite);
    OptionalDouble avgFlow = averageOf(constituentIds, flow);
    if (avgComposite.isEmpty() || avgFlow.isEmpty()) {
      return Optional.empty();
    }
    boolean active = alertRepository.existsActiveAlertForTheme(RULE_THEME_DISTRIBUTE_WARNING, themeId);
    return Optional.of(
        new Distribution(themeId, avgComposite.getAsDouble(), avgFlow.getAsDouble(), active));
  }

  private OptionalDouble averageOf(List<String> ids, Map<String, BigDecimal> values) {
    return ids.stream()
        .map(values::get)
        .filter(value -> value != null)
        .mapToDouble(BigDecimal::doubleValue)
        .average();
  }

  private void fire(Distribution distribution, Severity severity, LocalDate signalDate) {
    String themeId = distribution.themeId();
    alertRepository.insert(
        new Alert(
            null,
            OffsetDateTime.now(),
            null,
            themeId,
            RULE_THEME_DISTRIBUTE_WARNING,
            severity,
            String.format(
                "%s theme may be distributing: score %d (BUY territory) but 20d flow %.2fσ — smart money exiting",
                themeId, distribution.scorePercent(), distribution.flow()),
            String.format(
                "{\"themeId\":\"%s\",\"avgScore\":%.4f,\"avgFlow\":%.4f,\"signalDate\":\"%s\"}",
                themeId, distribution.score(), distribution.flow(), signalDate),
            AlertStatus.ACTIVE,
            null,
            null));
    log.info(
        "theme_distribute_warning: theme={} score={} flow={}",
        themeId,
        distribution.scorePercent(),
        distribution.flow());
  }

  private void resolve(Distribution distribution) {
    alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_DISTRIBUTE_WARNING, distribution.themeId());
    log.info("theme_distribute_warning: resolved theme={} (flow normalising)", distribution.themeId());
  }

  /** A theme's average score-vs-flow reading for the day. */
  private record Distribution(String themeId, double score, double flow, boolean hasActiveAlert) {
    int scorePercent() {
      return (int) Math.round(score * 100);
    }

    boolean shouldFire() {
      return score >= THEME_DISTRIBUTE_SCORE_THRESHOLD
          && flow <= THEME_DISTRIBUTE_FLOW_THRESHOLD
          && !hasActiveAlert;
    }

    boolean shouldResolve() {
      return hasActiveAlert && flow > THEME_DISTRIBUTE_FLOW_RESOLVE;
    }
  }
}
