package com.ftm.app.alerts.evaluator;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.AlertStatus;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.Severity;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Fires per sector on the day RS-60 crosses RS-120 (in either direction) — a shift in whether
 * near-term relative strength is running above or below the long-term baseline. A bullish crossover
 * (RS-60 up through RS-120) flags accelerating momentum; a bearish crossover flags deceleration.
 */
@Component
public class RsAccelerationCrossoverAlertEvaluator implements AlertEvaluator {

  private static final Logger log =
      LoggerFactory.getLogger(RsAccelerationCrossoverAlertEvaluator.class);

  private static final String RULE_RS_ACCEL_CROSSOVER = "rs_accel_crossover";

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public RsAccelerationCrossoverAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    Optional<AlertRule> rsAccelRule = alertRulesRepository.findById(RULE_RS_ACCEL_CROSSOVER);
    if (!rsAccelRule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rsAccelRule.map(AlertRule::severity).orElse(Severity.INFO);

    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> currentRs60 =
        signalRepository.findByTypeAndDate(SignalType.RS_60, signalDate);
    Map<String, BigDecimal> currentRs120 =
        signalRepository.findByTypeAndDate(SignalType.RS_120, signalDate);
    if (currentRs60.isEmpty() || currentRs120.isEmpty()) return 0;

    LocalDate prevDate = signalRepository.findPreviousSignalDate(SignalType.RS_60, signalDate);
    if (prevDate == null) return 0;

    Map<String, BigDecimal> prevRs60 = signalRepository.findByTypeAndDate(SignalType.RS_60, prevDate);
    Map<String, BigDecimal> prevRs120 =
        signalRepository.findByTypeAndDate(SignalType.RS_120, prevDate);

    int count = 0;
    for (String categoryId : currentRs60.keySet()) {
      if (!context.topLevelCategoryIds().contains(categoryId)) continue;
      BigDecimal rs60 = currentRs60.get(categoryId);
      BigDecimal rs120 = currentRs120.get(categoryId);
      BigDecimal prevRs60Val = prevRs60.get(categoryId);
      BigDecimal prevRs120Val = prevRs120.get(categoryId);
      if (rs60 == null || rs120 == null || prevRs60Val == null || prevRs120Val == null) continue;

      boolean nowAbove = rs60.compareTo(rs120) > 0;
      boolean wasAbove = prevRs60Val.compareTo(prevRs120Val) > 0;
      if (nowAbove == wasAbove) continue; // no crossover this day
      if (alertRepository.existsActiveAlert(RULE_RS_ACCEL_CROSSOVER, categoryId)) continue;

      CategoryId catId;
      try {
        catId = CategoryId.valueOf(categoryId);
      } catch (IllegalArgumentException e) {
        log.debug("rs_accel_crossover: skipping unknown CategoryId={}", categoryId);
        continue;
      }

      String message =
          nowAbove
              ? String.format(
                  "%s RS-60 crossed above RS-120 — near-term momentum accelerating beyond long-term baseline",
                  categoryId)
              : String.format(
                  "%s RS-60 crossed below RS-120 — near-term momentum decelerating below long-term baseline",
                  categoryId);
      String snapshot =
          String.format(
              "{\"direction\":\"%s\",\"rs60\":%.4f,\"rs120\":%.4f,\"prevRs60\":%.4f,\"prevRs120\":%.4f,\"signalDate\":\"%s\"}",
              nowAbove ? "bullish" : "bearish", rs60, rs120, prevRs60Val, prevRs120Val, signalDate);
      alertRepository.insert(
          new Alert(
              OffsetDateTime.now(),
              catId,
              RULE_RS_ACCEL_CROSSOVER,
              severity,
              message,
              snapshot,
              AlertStatus.ACTIVE));
      count++;
      log.info(
          "rs_accel_crossover alert: category={} direction={} rs60={} rs120={}",
          categoryId,
          nowAbove ? "bullish" : "bearish",
          rs60,
          rs120);
    }
    return count;
  }
}
