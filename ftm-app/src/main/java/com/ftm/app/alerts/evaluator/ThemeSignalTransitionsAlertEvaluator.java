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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Fires per theme when a majority of its constituents cross into BUY (or into REDUCE) territory —
 * the theme itself has flipped its dominant signal, i.e. cross-sector rotation is confirmed.
 * Resolves when neither side is a majority any more.
 */
@Component
public class ThemeSignalTransitionsAlertEvaluator implements AlertEvaluator {

  private static final Logger log =
      LoggerFactory.getLogger(ThemeSignalTransitionsAlertEvaluator.class);

  private static final String RULE_THEME_SIGNAL_TRANSITION = "theme_dominant_signal_transition";
  private static final double THEME_BUY_FIRE_FRACTION = 0.50;
  private static final double THEME_REDUCE_FIRE_FRACTION = 0.50;
  private static final BigDecimal BUY_SCORE_THRESHOLD = new BigDecimal("0.65");
  private static final BigDecimal REDUCE_SCORE_THRESHOLD = new BigDecimal("0.35");

  private final AlertRulesRepository alertRulesRepository;
  private final ThemeRepository themeRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public ThemeSignalTransitionsAlertEvaluator(
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

    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_SIGNAL_TRANSITION);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.ACTION);

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    if (constituentsByTheme.isEmpty()) return 0;

    Map<String, BigDecimal> compositeMap =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    if (compositeMap.isEmpty()) return 0;

    int count = 0;
    for (Map.Entry<String, List<String>> entry : constituentsByTheme.entrySet()) {
      String themeId = entry.getKey();
      List<String> ids = entry.getValue();
      if (ids.isEmpty()) continue;

      long buyCount =
          ids.stream()
              .map(compositeMap::get)
              .filter(s -> s != null && s.compareTo(BUY_SCORE_THRESHOLD) >= 0)
              .count();
      long reduceCount =
          ids.stream()
              .map(compositeMap::get)
              .filter(s -> s != null && s.compareTo(REDUCE_SCORE_THRESHOLD) < 0)
              .count();
      int total = ids.size();

      double buyFraction = (double) buyCount / total;
      double reduceFraction = (double) reduceCount / total;
      boolean isBuyMajority = buyFraction >= THEME_BUY_FIRE_FRACTION;
      boolean isReduceMajority = reduceFraction >= THEME_REDUCE_FIRE_FRACTION;

      boolean hasActive =
          alertRepository.existsActiveAlertForTheme(RULE_THEME_SIGNAL_TRANSITION, themeId);

      if (isBuyMajority && !isReduceMajority && !hasActive) {
        alertRepository.insert(
            new Alert(
                null,
                OffsetDateTime.now(),
                null,
                themeId,
                RULE_THEME_SIGNAL_TRANSITION,
                severity,
                String.format(
                    "%s theme entered BUY: %d/%d constituents above BUY threshold — cross-sector rotation confirmed",
                    themeId, buyCount, total),
                String.format(
                    "{\"themeId\":\"%s\",\"buyFraction\":%.2f,\"buyCount\":%d,\"total\":%d,\"signalDate\":\"%s\"}",
                    themeId, buyFraction, buyCount, total, signalDate),
                AlertStatus.ACTIVE,
                null,
                null));
        count++;
        log.info(
            "theme_signal_transition BUY: theme={} buyFraction={}% ({}/{})",
            themeId, Math.round(buyFraction * 100), buyCount, total);

      } else if (isReduceMajority && !isBuyMajority && !hasActive) {
        alertRepository.insert(
            new Alert(
                null,
                OffsetDateTime.now(),
                null,
                themeId,
                RULE_THEME_SIGNAL_TRANSITION,
                severity,
                String.format(
                    "%s theme entered REDUCE: %d/%d constituents below REDUCE threshold — theme rotation reversing",
                    themeId, reduceCount, total),
                String.format(
                    "{\"themeId\":\"%s\",\"reduceFraction\":%.2f,\"reduceCount\":%d,\"total\":%d,\"signalDate\":\"%s\"}",
                    themeId, reduceFraction, reduceCount, total, signalDate),
                AlertStatus.ACTIVE,
                null,
                null));
        count++;
        log.info(
            "theme_signal_transition REDUCE: theme={} reduceFraction={}% ({}/{})",
            themeId, Math.round(reduceFraction * 100), reduceCount, total);

      } else if (hasActive && !isBuyMajority && !isReduceMajority) {
        alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_SIGNAL_TRANSITION, themeId);
        log.info("theme_signal_transition: resolved theme={} (signal neutralised)", themeId);
      }
    }
    return count;
  }
}
