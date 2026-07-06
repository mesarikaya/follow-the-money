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

  private static final String RULE_THEME_MOMENTUM_SURGE = "theme_momentum_surge";
  private static final String RULE_THEME_MOMENTUM_COLLAPSE = "theme_momentum_collapse";
  private static final double THEME_MOMENTUM_SURGE_THRESHOLD = 0.010;
  private static final double THEME_MOMENTUM_COLLAPSE_THRESHOLD = -0.010;
  private static final double THEME_MOMENTUM_SURGE_RESOLVE = 0.003;
  private static final double THEME_MOMENTUM_COLLAPSE_RESOLVE = -0.003;

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
    LocalDate signalDate = context.signalDate();

    Optional<AlertRule> surgeRule = alertRulesRepository.findById(RULE_THEME_MOMENTUM_SURGE);
    Optional<AlertRule> collapseRule = alertRulesRepository.findById(RULE_THEME_MOMENTUM_COLLAPSE);
    boolean surgeEnabled = surgeRule.map(AlertRule::enabled).orElse(false);
    boolean collapseEnabled = collapseRule.map(AlertRule::enabled).orElse(false);
    if (!surgeEnabled && !collapseEnabled) return 0;

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    if (constituentsByTheme.isEmpty()) return 0;

    Map<String, BigDecimal> trendMap =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, signalDate);
    if (trendMap.isEmpty()) return 0;

    int count = 0;
    for (Map.Entry<String, List<String>> entry : constituentsByTheme.entrySet()) {
      String themeId = entry.getKey();
      List<String> ids = entry.getValue();
      if (ids.isEmpty()) continue;

      OptionalDouble avgTrend =
          ids.stream()
              .map(trendMap::get)
              .filter(v -> v != null)
              .mapToDouble(BigDecimal::doubleValue)
              .average();
      if (avgTrend.isEmpty()) continue;

      double trend = avgTrend.getAsDouble();
      int trendPt = (int) Math.round(trend * 100);

      if (surgeEnabled) {
        boolean hasSurgeActive =
            alertRepository.existsActiveAlertForTheme(RULE_THEME_MOMENTUM_SURGE, themeId);
        if (trend >= THEME_MOMENTUM_SURGE_THRESHOLD && !hasSurgeActive) {
          Severity severity = surgeRule.map(AlertRule::severity).orElse(Severity.ACTION);
          alertRepository.insert(
              new Alert(
                  null,
                  OffsetDateTime.now(),
                  null,
                  themeId,
                  RULE_THEME_MOMENTUM_SURGE,
                  severity,
                  String.format(
                      "%s theme momentum surging: avg 20d velocity +%dpt/day across %d constituents",
                      themeId, trendPt, ids.size()),
                  String.format(
                      "{\"themeId\":\"%s\",\"avgTrend20d\":%.4f,\"signalDate\":\"%s\"}",
                      themeId, trend, signalDate),
                  AlertStatus.ACTIVE,
                  null,
                  null));
          count++;
          log.info("theme_momentum_surge: theme={} avgTrend20d={}pt/day", themeId, trendPt);
        } else if (hasSurgeActive && trend < THEME_MOMENTUM_SURGE_RESOLVE) {
          alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_MOMENTUM_SURGE, themeId);
          log.info("theme_momentum_surge: resolved theme={} (momentum normalised)", themeId);
        }
      }

      if (collapseEnabled) {
        boolean hasCollapseActive =
            alertRepository.existsActiveAlertForTheme(RULE_THEME_MOMENTUM_COLLAPSE, themeId);
        if (trend <= THEME_MOMENTUM_COLLAPSE_THRESHOLD && !hasCollapseActive) {
          Severity severity = collapseRule.map(AlertRule::severity).orElse(Severity.WARNING);
          alertRepository.insert(
              new Alert(
                  null,
                  OffsetDateTime.now(),
                  null,
                  themeId,
                  RULE_THEME_MOMENTUM_COLLAPSE,
                  severity,
                  String.format(
                      "%s theme collapsing: avg 20d velocity %dpt/day — consider reducing exposure",
                      themeId, trendPt),
                  String.format(
                      "{\"themeId\":\"%s\",\"avgTrend20d\":%.4f,\"signalDate\":\"%s\"}",
                      themeId, trend, signalDate),
                  AlertStatus.ACTIVE,
                  null,
                  null));
          count++;
          log.info("theme_momentum_collapse: theme={} avgTrend20d={}pt/day", themeId, trendPt);
        } else if (hasCollapseActive && trend > THEME_MOMENTUM_COLLAPSE_RESOLVE) {
          alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_MOMENTUM_COLLAPSE, themeId);
          log.info("theme_momentum_collapse: resolved theme={} (momentum stabilising)", themeId);
        }
      }
    }
    return count;
  }
}
