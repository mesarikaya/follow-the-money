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
import java.util.List;
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
    Optional<AlertRule> bullRule = alertRulesRepository.findById(Direction.BULL.ruleId);
    Optional<AlertRule> bearRule = alertRulesRepository.findById(Direction.BEAR.ruleId);
    boolean bullEnabled = bullRule.map(AlertRule::enabled).orElse(false);
    boolean bearEnabled = bearRule.map(AlertRule::enabled).orElse(false);
    if (!bullEnabled && !bearEnabled) {
      return 0;
    }

    LocalDate signalDate = context.signalDate();
    HorizonSnapshot current = loadHorizons(signalDate);
    if (current.isIncomplete()) {
      return 0;
    }

    HorizonSnapshot previous = loadPreviousHorizons(signalDate);
    Map<Direction, Severity> severities =
        Map.of(
            Direction.BULL, bullRule.map(AlertRule::severity).orElse(Severity.INFO),
            Direction.BEAR, bearRule.map(AlertRule::severity).orElse(Severity.WARNING));

    List<Alignment> alignments =
        context.topLevelCategoryIds().stream()
            .map(categoryId -> assess(categoryId, current, bullEnabled, bearEnabled))
            .flatMap(Optional::stream)
            .filter(alignment -> isFirstDay(alignment, previous))
            .filter(this::notAlreadyAlerted)
            .toList();

    alignments.forEach(alignment -> fire(alignment, severities.get(alignment.direction()), signalDate));
    return alignments.size();
  }

  private Optional<Alignment> assess(
      String categoryId, HorizonSnapshot current, boolean bullEnabled, boolean bearEnabled) {
    BigDecimal rs20 = current.rs20().get(categoryId);
    BigDecimal rs60 = current.rs60().get(categoryId);
    BigDecimal rs120 = current.rs120().get(categoryId);
    if (rs20 == null || rs60 == null || rs120 == null) {
      return Optional.empty();
    }
    return alignedDirection(rs20, rs60, rs120, bullEnabled, bearEnabled)
        .flatMap(
            direction ->
                knownCategory(categoryId, direction)
                    .map(category -> new Alignment(categoryId, category, direction, rs20, rs60, rs120)));
  }

  private Optional<Direction> alignedDirection(
      BigDecimal rs20, BigDecimal rs60, BigDecimal rs120, boolean bullEnabled, boolean bearEnabled) {
    return bullEnabled && Direction.BULL.aligned(rs20, rs60, rs120)
        ? Optional.of(Direction.BULL)
        : bearEnabled && Direction.BEAR.aligned(rs20, rs60, rs120)
            ? Optional.of(Direction.BEAR)
            : Optional.empty();
  }

  /** True only on the transition day — the sector was NOT aligned the same way yesterday. */
  private boolean isFirstDay(Alignment alignment, HorizonSnapshot previous) {
    BigDecimal prev20 = previous.rs20().get(alignment.categoryId());
    BigDecimal prev60 = previous.rs60().get(alignment.categoryId());
    BigDecimal prev120 = previous.rs120().get(alignment.categoryId());
    boolean hadYesterday = prev20 != null && prev60 != null && prev120 != null;
    return !hadYesterday || !alignment.direction().aligned(prev20, prev60, prev120);
  }

  private boolean notAlreadyAlerted(Alignment alignment) {
    return !alertRepository.existsActiveAlert(alignment.direction().ruleId, alignment.categoryId());
  }

  private void fire(Alignment alignment, Severity severity, LocalDate signalDate) {
    Direction direction = alignment.direction();
    alertRepository.insert(
        new Alert(
            OffsetDateTime.now(),
            alignment.category(),
            direction.ruleId,
            severity,
            direction.message(alignment.categoryId()),
            String.format(
                "{\"rs20\":%.4f,\"rs60\":%.4f,\"rs120\":%.4f,\"signalDate\":\"%s\"}",
                alignment.rs20(), alignment.rs60(), alignment.rs120(), signalDate),
            AlertStatus.ACTIVE));
    log.info(
        "{}: category={} rs20={} rs60={} rs120={}",
        direction.ruleId,
        alignment.categoryId(),
        alignment.rs20(),
        alignment.rs60(),
        alignment.rs120());
  }

  private Optional<CategoryId> knownCategory(String categoryId, Direction direction) {
    try {
      return Optional.of(CategoryId.valueOf(categoryId));
    } catch (IllegalArgumentException e) {
      log.debug("{}: skipping unknown CategoryId={}", direction.ruleId, categoryId);
      return Optional.empty();
    }
  }

  private HorizonSnapshot loadPreviousHorizons(LocalDate signalDate) {
    LocalDate prevDate = signalRepository.findPreviousSignalDate(SignalType.RS_20, signalDate);
    return prevDate != null ? loadHorizons(prevDate) : HorizonSnapshot.empty();
  }

  private HorizonSnapshot loadHorizons(LocalDate date) {
    return new HorizonSnapshot(
        signalRepository.findByTypeAndDate(SignalType.RS_20, date),
        signalRepository.findByTypeAndDate(SignalType.RS_60, date),
        signalRepository.findByTypeAndDate(SignalType.RS_120, date));
  }

  /** A sector whose RS horizons aligned in one direction today. */
  private record Alignment(
      String categoryId,
      CategoryId category,
      Direction direction,
      BigDecimal rs20,
      BigDecimal rs60,
      BigDecimal rs120) {}

  private enum Direction {
    BULL(
        "rs_aligned_bull",
        "%s RS-20 > RS-60 > RS-120 fully aligned — momentum building across all horizons"),
    BEAR(
        "rs_aligned_bear",
        "%s RS-20 < RS-60 < RS-120 fully aligned bearish — momentum deteriorating across all horizons");

    private final String ruleId;
    private final String messageTemplate;

    Direction(String ruleId, String messageTemplate) {
      this.ruleId = ruleId;
      this.messageTemplate = messageTemplate;
    }

    boolean aligned(BigDecimal rs20, BigDecimal rs60, BigDecimal rs120) {
      return this == BULL
          ? rs20.compareTo(rs60) > 0 && rs60.compareTo(rs120) > 0
          : rs20.compareTo(rs60) < 0 && rs60.compareTo(rs120) < 0;
    }

    String message(String categoryId) {
      return String.format(messageTemplate, categoryId);
    }
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
