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
    LocalDate signalDate = context.signalDate();

    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_DISTRIBUTE_WARNING);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    if (constituentsByTheme.isEmpty()) return 0;

    Map<String, BigDecimal> compositeMap =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> flowMap =
        signalRepository.findByTypeAndDate(SignalType.FLOW_20D, signalDate);
    if (compositeMap.isEmpty() || flowMap.isEmpty()) return 0;

    int count = 0;
    for (Map.Entry<String, List<String>> entry : constituentsByTheme.entrySet()) {
      String themeId = entry.getKey();
      List<String> ids = entry.getValue();
      if (ids.isEmpty()) continue;

      OptionalDouble avgComposite =
          ids.stream()
              .map(compositeMap::get)
              .filter(v -> v != null)
              .mapToDouble(BigDecimal::doubleValue)
              .average();
      OptionalDouble avgFlow =
          ids.stream()
              .map(flowMap::get)
              .filter(v -> v != null)
              .mapToDouble(BigDecimal::doubleValue)
              .average();
      if (avgComposite.isEmpty() || avgFlow.isEmpty()) continue;

      double score = avgComposite.getAsDouble();
      double flow = avgFlow.getAsDouble();
      boolean hasActive =
          alertRepository.existsActiveAlertForTheme(RULE_THEME_DISTRIBUTE_WARNING, themeId);

      if (score >= THEME_DISTRIBUTE_SCORE_THRESHOLD
          && flow <= THEME_DISTRIBUTE_FLOW_THRESHOLD
          && !hasActive) {
        Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);
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
                    themeId, (int) Math.round(score * 100), flow),
                String.format(
                    "{\"themeId\":\"%s\",\"avgScore\":%.4f,\"avgFlow\":%.4f,\"signalDate\":\"%s\"}",
                    themeId, score, flow, signalDate),
                AlertStatus.ACTIVE,
                null,
                null));
        count++;
        log.info(
            "theme_distribute_warning: theme={} score={} flow={}",
            themeId,
            (int) Math.round(score * 100),
            flow);
      } else if (hasActive && flow > THEME_DISTRIBUTE_FLOW_RESOLVE) {
        alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_DISTRIBUTE_WARNING, themeId);
        log.info("theme_distribute_warning: resolved theme={} (flow normalising)", themeId);
      }
    }
    return count;
  }
}
