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
import java.util.List;
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
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_RS_ACCEL_CROSSOVER);
    if (!rule.map(AlertRule::enabled).orElse(false)) {
      return 0;
    }

    LocalDate signalDate = context.signalDate();
    Optional<Snapshot> snapshot = loadSnapshot(signalDate);
    if (snapshot.isEmpty()) {
      return 0;
    }

    Severity severity = rule.map(AlertRule::severity).orElse(Severity.INFO);
    List<Crossover> crossovers =
        context.topLevelCategoryIds().stream()
            .map(categoryId -> assess(categoryId, snapshot.get()))
            .flatMap(Optional::stream)
            .filter(this::notAlreadyAlerted)
            .toList();

    crossovers.forEach(crossover -> fire(crossover, severity, signalDate));
    return crossovers.size();
  }

  private Optional<Crossover> assess(String categoryId, Snapshot snapshot) {
    BigDecimal rs60 = snapshot.currentRs60().get(categoryId);
    BigDecimal rs120 = snapshot.currentRs120().get(categoryId);
    BigDecimal prevRs60 = snapshot.prevRs60().get(categoryId);
    BigDecimal prevRs120 = snapshot.prevRs120().get(categoryId);
    if (rs60 == null || rs120 == null || prevRs60 == null || prevRs120 == null) {
      return Optional.empty();
    }
    boolean nowAbove = rs60.compareTo(rs120) > 0;
    boolean wasAbove = prevRs60.compareTo(prevRs120) > 0;
    if (nowAbove == wasAbove) {
      return Optional.empty();
    }
    return knownCategory(categoryId)
        .map(category -> new Crossover(categoryId, category, nowAbove, rs60, rs120, prevRs60, prevRs120));
  }

  private boolean notAlreadyAlerted(Crossover crossover) {
    return !alertRepository.existsActiveAlert(RULE_RS_ACCEL_CROSSOVER, crossover.categoryId());
  }

  private void fire(Crossover crossover, Severity severity, LocalDate signalDate) {
    String direction = crossover.nowAbove() ? "bullish" : "bearish";
    alertRepository.insert(
        new Alert(
            OffsetDateTime.now(),
            crossover.category(),
            RULE_RS_ACCEL_CROSSOVER,
            severity,
            crossover.message(),
            String.format(
                "{\"direction\":\"%s\",\"rs60\":%.4f,\"rs120\":%.4f,\"prevRs60\":%.4f,\"prevRs120\":%.4f,\"signalDate\":\"%s\"}",
                direction,
                crossover.rs60(),
                crossover.rs120(),
                crossover.prevRs60(),
                crossover.prevRs120(),
                signalDate),
            AlertStatus.ACTIVE));
    log.info(
        "rs_accel_crossover alert: category={} direction={} rs60={} rs120={}",
        crossover.categoryId(),
        direction,
        crossover.rs60(),
        crossover.rs120());
  }

  private Optional<CategoryId> knownCategory(String categoryId) {
    try {
      return Optional.of(CategoryId.valueOf(categoryId));
    } catch (IllegalArgumentException e) {
      log.debug("rs_accel_crossover: skipping unknown CategoryId={}", categoryId);
      return Optional.empty();
    }
  }

  private Optional<Snapshot> loadSnapshot(LocalDate signalDate) {
    Map<String, BigDecimal> currentRs60 =
        signalRepository.findByTypeAndDate(SignalType.RS_60, signalDate);
    Map<String, BigDecimal> currentRs120 =
        signalRepository.findByTypeAndDate(SignalType.RS_120, signalDate);
    if (currentRs60.isEmpty() || currentRs120.isEmpty()) {
      return Optional.empty();
    }
    LocalDate prevDate = signalRepository.findPreviousSignalDate(SignalType.RS_60, signalDate);
    if (prevDate == null) {
      return Optional.empty();
    }
    return Optional.of(
        new Snapshot(
            currentRs60,
            currentRs120,
            signalRepository.findByTypeAndDate(SignalType.RS_60, prevDate),
            signalRepository.findByTypeAndDate(SignalType.RS_120, prevDate)));
  }

  /** Current and previous-day RS-60/RS-120 maps. */
  private record Snapshot(
      Map<String, BigDecimal> currentRs60,
      Map<String, BigDecimal> currentRs120,
      Map<String, BigDecimal> prevRs60,
      Map<String, BigDecimal> prevRs120) {}

  /** A sector that crossed RS-60 through RS-120 today. */
  private record Crossover(
      String categoryId,
      CategoryId category,
      boolean nowAbove,
      BigDecimal rs60,
      BigDecimal rs120,
      BigDecimal prevRs60,
      BigDecimal prevRs120) {

    String message() {
      return nowAbove
          ? String.format(
              "%s RS-60 crossed above RS-120 — near-term momentum accelerating beyond long-term baseline",
              categoryId)
          : String.format(
              "%s RS-60 crossed below RS-120 — near-term momentum decelerating below long-term baseline",
              categoryId);
    }
  }
}
