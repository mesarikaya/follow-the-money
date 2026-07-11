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
import java.util.Collections;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Fires per sector when relative strength aligns across all three horizons on the first day of that
 * alignment: BULL when RS-20 &gt; RS-60 &gt; RS-120 (momentum building everywhere), BEAR when RS-20
 * &lt; RS-60 &lt; RS-120 (momentum deteriorating everywhere). Firing only on the transition day
 * (not yet aligned yesterday) avoids re-alerting the same run. Resolution is handled centrally by
 * the engine's stale-alert sweep.
 */
@Component
public class RsAlignedAlertEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(RsAlignedAlertEvaluator.class);

  private static final String RULE_RS_ALIGNED_BULL = "rs_aligned_bull";
  private static final String RULE_RS_ALIGNED_BEAR = "rs_aligned_bear";

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public RsAlignedAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    Optional<AlertRule> bullRule = alertRulesRepository.findById(RULE_RS_ALIGNED_BULL);
    Optional<AlertRule> bearRule = alertRulesRepository.findById(RULE_RS_ALIGNED_BEAR);
    boolean bullEnabled = bullRule.map(AlertRule::enabled).orElse(false);
    boolean bearEnabled = bearRule.map(AlertRule::enabled).orElse(false);
    if (!bullEnabled && !bearEnabled) return 0;

    LocalDate signalDate = context.signalDate();
    HorizonSnapshot current = loadHorizons(signalDate);
    if (current.isIncomplete()) return 0;

    LocalDate prevDate = signalRepository.findPreviousSignalDate(SignalType.RS_20, signalDate);
    HorizonSnapshot previous = prevDate != null ? loadHorizons(prevDate) : HorizonSnapshot.empty();

    int count = 0;
    for (String categoryId : context.topLevelCategoryIds()) {
      BigDecimal rs20 = current.rs20().get(categoryId);
      BigDecimal rs60 = current.rs60().get(categoryId);
      BigDecimal rs120 = current.rs120().get(categoryId);
      if (rs20 == null || rs60 == null || rs120 == null) continue;

      if (bullEnabled && isBullAligned(rs20, rs60, rs120)) {
        count +=
            fireOnTransition(
                categoryId,
                rs20,
                rs60,
                rs120,
                previous,
                true,
                bullRule.get().severity(),
                signalDate);
      }
      if (bearEnabled && isBearAligned(rs20, rs60, rs120)) {
        count +=
            fireOnTransition(
                categoryId,
                rs20,
                rs60,
                rs120,
                previous,
                false,
                bearRule.get().severity(),
                signalDate);
      }
    }
    return count;
  }

  private boolean isBullAligned(BigDecimal rs20, BigDecimal rs60, BigDecimal rs120) {
    return rs20.compareTo(rs60) > 0 && rs60.compareTo(rs120) > 0;
  }

  private boolean isBearAligned(BigDecimal rs20, BigDecimal rs60, BigDecimal rs120) {
    return rs20.compareTo(rs60) < 0 && rs60.compareTo(rs120) < 0;
  }

  private int fireOnTransition(
      String categoryId,
      BigDecimal rs20,
      BigDecimal rs60,
      BigDecimal rs120,
      HorizonSnapshot previous,
      boolean bull,
      Severity severity,
      LocalDate signalDate) {
    String ruleId = bull ? RULE_RS_ALIGNED_BULL : RULE_RS_ALIGNED_BEAR;
    if (alertRepository.existsActiveAlert(ruleId, categoryId)) return 0;

    // Only fire on the first day of alignment (was not fully aligned yesterday).
    BigDecimal prev20 = previous.rs20().get(categoryId);
    BigDecimal prev60 = previous.rs60().get(categoryId);
    BigDecimal prev120 = previous.rs120().get(categoryId);
    if (prev20 != null && prev60 != null && prev120 != null) {
      boolean wasAligned =
          bull ? isBullAligned(prev20, prev60, prev120) : isBearAligned(prev20, prev60, prev120);
      if (wasAligned) return 0;
    }

    CategoryId catId;
    try {
      catId = CategoryId.valueOf(categoryId);
    } catch (IllegalArgumentException e) {
      log.debug("{}: skipping unknown CategoryId={}", ruleId, categoryId);
      return 0;
    }

    String message =
        bull
            ? String.format(
                "%s RS-20 > RS-60 > RS-120 fully aligned — momentum building across all horizons",
                categoryId)
            : String.format(
                "%s RS-20 < RS-60 < RS-120 fully aligned bearish — momentum deteriorating across all horizons",
                categoryId);
    String snapshot =
        String.format(
            "{\"rs20\":%.4f,\"rs60\":%.4f,\"rs120\":%.4f,\"signalDate\":\"%s\"}",
            rs20, rs60, rs120, signalDate);
    alertRepository.insert(
        new Alert(
            OffsetDateTime.now(), catId, ruleId, severity, message, snapshot, AlertStatus.ACTIVE));
    log.info("{}: category={} rs20={} rs60={} rs120={}", ruleId, categoryId, rs20, rs60, rs120);
    return 1;
  }

  private HorizonSnapshot loadHorizons(LocalDate date) {
    return new HorizonSnapshot(
        signalRepository.findByTypeAndDate(SignalType.RS_20, date),
        signalRepository.findByTypeAndDate(SignalType.RS_60, date),
        signalRepository.findByTypeAndDate(SignalType.RS_120, date));
  }

  /** The three RS-horizon maps for a single date. */
  private record HorizonSnapshot(
      Map<String, BigDecimal> rs20, Map<String, BigDecimal> rs60, Map<String, BigDecimal> rs120) {

    static HorizonSnapshot empty() {
      return new HorizonSnapshot(
          Collections.emptyMap(), Collections.emptyMap(), Collections.emptyMap());
    }

    boolean isIncomplete() {
      return rs20.isEmpty() || rs60.isEmpty() || rs120.isEmpty();
    }
  }
}
