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
 * Fires per theme when its constituents' average 20-day composite velocity surges (momentum
 * building) or collapses (momentum reversing). Each direction is its own configurable rule and
 * resolves when velocity returns toward neutral.
 */
@Component
public class ThemeMomentumAlertEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(ThemeMomentumAlertEvaluator.class);

  private final AlertRulesRepository alertRulesRepository;
  private final ThemeRepository themeRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public ThemeMomentumAlertEvaluator(
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
    Optional<AlertRule> surgeRule = alertRulesRepository.findById(Direction.SURGE.ruleId);
    Optional<AlertRule> collapseRule = alertRulesRepository.findById(Direction.COLLAPSE.ruleId);
    boolean surgeEnabled = surgeRule.map(AlertRule::enabled).orElse(false);
    boolean collapseEnabled = collapseRule.map(AlertRule::enabled).orElse(false);
    if (!surgeEnabled && !collapseEnabled) {
      return 0;
    }

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> trendMap =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, signalDate);
    if (constituentsByTheme.isEmpty() || trendMap.isEmpty()) {
      return 0;
    }

    List<ThemeMetric> metrics =
        constituentsByTheme.entrySet().stream()
            .map(entry -> assess(entry.getKey(), entry.getValue(), trendMap))
            .flatMap(Optional::stream)
            .toList();

    int fired = 0;
    if (surgeEnabled) {
      fired += apply(Direction.SURGE, metrics, severityOf(surgeRule, Severity.ACTION), signalDate);
    }
    if (collapseEnabled) {
      fired +=
          apply(Direction.COLLAPSE, metrics, severityOf(collapseRule, Severity.WARNING), signalDate);
    }
    return fired;
  }

  private Optional<ThemeMetric> assess(
      String themeId, List<String> constituentIds, Map<String, BigDecimal> trendMap) {
    if (constituentIds.isEmpty()) {
      return Optional.empty();
    }
    OptionalDouble avgTrend =
        constituentIds.stream()
            .map(trendMap::get)
            .filter(value -> value != null)
            .mapToDouble(BigDecimal::doubleValue)
            .average();
    return avgTrend.isPresent()
        ? Optional.of(new ThemeMetric(themeId, constituentIds.size(), avgTrend.getAsDouble()))
        : Optional.empty();
  }

  private int apply(
      Direction direction, List<ThemeMetric> metrics, Severity severity, LocalDate signalDate) {
    List<ThemeMetric> toFire =
        metrics.stream()
            .filter(metric -> direction.fires(metric.trend()))
            .filter(metric -> !hasActive(direction, metric))
            .toList();
    toFire.forEach(metric -> fire(direction, metric, severity, signalDate));

    metrics.stream()
        .filter(metric -> hasActive(direction, metric))
        .filter(metric -> direction.resolves(metric.trend()))
        .forEach(metric -> resolve(direction, metric));
    return toFire.size();
  }

  private boolean hasActive(Direction direction, ThemeMetric metric) {
    return alertRepository.existsActiveAlertForTheme(direction.ruleId, metric.themeId());
  }

  private void fire(Direction direction, ThemeMetric metric, Severity severity, LocalDate signalDate) {
    String themeId = metric.themeId();
    alertRepository.insert(
        new Alert(
            null,
            OffsetDateTime.now(),
            null,
            themeId,
            direction.ruleId,
            severity,
            direction.message(themeId, metric.trendPoint(), metric.constituentCount()),
            String.format(
                "{\"themeId\":\"%s\",\"avgTrend20d\":%.4f,\"signalDate\":\"%s\"}",
                themeId, metric.trend(), signalDate),
            AlertStatus.ACTIVE,
            null,
            null));
    log.info("{}: theme={} avgTrend20d={}pt/day", direction.ruleId, themeId, metric.trendPoint());
  }

  private void resolve(Direction direction, ThemeMetric metric) {
    alertRepository.resolveAlertsByRuleAndTheme(direction.ruleId, metric.themeId());
    log.info("{}: resolved theme={}", direction.ruleId, metric.themeId());
  }

  private Severity severityOf(Optional<AlertRule> rule, Severity fallback) {
    return rule.map(AlertRule::severity).orElse(fallback);
  }

  /** A theme's average 20-day constituent velocity for the day. */
  private record ThemeMetric(String themeId, int constituentCount, double trend) {
    int trendPoint() {
      return (int) Math.round(trend * 100);
    }
  }

  private enum Direction {
    SURGE(
        "theme_momentum_surge",
        0.010,
        0.003,
        "%s theme momentum surging: avg 20d velocity +%dpt/day across %d constituents"),
    COLLAPSE(
        "theme_momentum_collapse",
        -0.010,
        -0.003,
        "%s theme collapsing: avg 20d velocity %dpt/day — consider reducing exposure");

    private final String ruleId;
    private final double fireThreshold;
    private final double resolveThreshold;
    private final String messageTemplate;

    Direction(String ruleId, double fireThreshold, double resolveThreshold, String messageTemplate) {
      this.ruleId = ruleId;
      this.fireThreshold = fireThreshold;
      this.resolveThreshold = resolveThreshold;
      this.messageTemplate = messageTemplate;
    }

    boolean fires(double trend) {
      return this == SURGE ? trend >= fireThreshold : trend <= fireThreshold;
    }

    boolean resolves(double trend) {
      return this == SURGE ? trend < resolveThreshold : trend > resolveThreshold;
    }

    String message(String themeId, int trendPoint, int constituentCount) {
      return this == SURGE
          ? String.format(messageTemplate, themeId, trendPoint, constituentCount)
          : String.format(messageTemplate, themeId, trendPoint);
    }
  }
}
