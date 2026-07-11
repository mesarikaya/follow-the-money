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
 * Fires the formal BUY / REDUCE trade signals on the day a sector first meets all conditions (it did
 * not meet them on the previous signal date — a genuine transition, not a persisting state):
 *
 * <ul>
 *   <li><b>BUY</b> — composite ≥ 0.65, RRG Leading/Improving (3/4), and 20d trend positive.
 *   <li><b>REDUCE</b> — composite &lt; 0.35 and RRG Lagging/Weakening (1/2).
 * </ul>
 *
 * Resolution is handled centrally by the engine's stale-alert sweep.
 */
@Component
public class TradeSignalTransitionsAlertEvaluator implements AlertEvaluator {

  private static final Logger log =
      LoggerFactory.getLogger(TradeSignalTransitionsAlertEvaluator.class);

  private static final BigDecimal BUY_SCORE_THRESHOLD = new BigDecimal("0.65");
  private static final BigDecimal REDUCE_SCORE_THRESHOLD = new BigDecimal("0.35");
  private static final BigDecimal ONE_HUNDRED = BigDecimal.valueOf(100);

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public TradeSignalTransitionsAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    Optional<AlertRule> buyRule = alertRulesRepository.findById(Direction.BUY.ruleId);
    Optional<AlertRule> reduceRule = alertRulesRepository.findById(Direction.REDUCE.ruleId);
    boolean buyEnabled = buyRule.map(AlertRule::enabled).orElse(false);
    boolean reduceEnabled = reduceRule.map(AlertRule::enabled).orElse(false);
    if (!buyEnabled && !reduceEnabled) {
      return 0;
    }

    LocalDate signalDate = context.signalDate();
    SignalWindow today = loadWindow(signalDate);
    SignalWindow previous = loadPreviousWindow(signalDate);
    Map<Direction, Severity> severities =
        Map.of(
            Direction.BUY, buyRule.map(AlertRule::severity).orElse(Severity.ACTION),
            Direction.REDUCE, reduceRule.map(AlertRule::severity).orElse(Severity.WARNING));

    List<Transition> transitions =
        context.topLevelCategoryIds().stream()
            .map(categoryId -> assess(categoryId, today, buyEnabled, reduceEnabled))
            .flatMap(Optional::stream)
            .filter(transition -> isFirstDay(transition, previous))
            .filter(this::notAlreadyAlerted)
            .toList();

    transitions.forEach(transition -> fire(transition, severities.get(transition.direction()), signalDate));
    return transitions.size();
  }

  private Optional<Transition> assess(
      String categoryId, SignalWindow today, boolean buyEnabled, boolean reduceEnabled) {
    BigDecimal score = today.composite().get(categoryId);
    if (score == null) {
      return Optional.empty();
    }
    int quadrant = intValue(today.rrg().get(categoryId));
    BigDecimal trend = today.trend20d().get(categoryId);
    return signalDirection(score, quadrant, trend, buyEnabled, reduceEnabled)
        .flatMap(
            direction ->
                knownCategory(categoryId)
                    .map(category -> new Transition(categoryId, category, direction, score, quadrant, trend)));
  }

  private Optional<Direction> signalDirection(
      BigDecimal score, int quadrant, BigDecimal trend, boolean buyEnabled, boolean reduceEnabled) {
    return buyEnabled && isBuy(score, quadrant, trend)
        ? Optional.of(Direction.BUY)
        : reduceEnabled && isReduce(score, quadrant) ? Optional.of(Direction.REDUCE) : Optional.empty();
  }

  /** True only on the transition day — the same signal did NOT hold on the previous signal date. */
  private boolean isFirstDay(Transition transition, SignalWindow previous) {
    String categoryId = transition.categoryId();
    BigDecimal prevScore = previous.composite().get(categoryId);
    int prevQuadrant = intValue(previous.rrg().get(categoryId));
    BigDecimal prevTrend = previous.trend20d().get(categoryId);
    boolean heldYesterday =
        switch (transition.direction()) {
          case BUY -> isBuy(prevScore, prevQuadrant, prevTrend);
          case REDUCE -> isReduce(prevScore, prevQuadrant);
        };
    return !heldYesterday;
  }

  private boolean notAlreadyAlerted(Transition transition) {
    return !alertRepository.existsActiveAlert(transition.direction().ruleId, transition.categoryId());
  }

  private void fire(Transition transition, Severity severity, LocalDate signalDate) {
    Direction direction = transition.direction();
    int scorePct = transition.score().multiply(ONE_HUNDRED).intValue();
    String rrgLabel = direction.rrgLabel(transition.quadrant());
    alertRepository.insert(
        new Alert(
            OffsetDateTime.now(),
            transition.category(),
            direction.ruleId,
            severity,
            direction.message(transition.categoryId(), scorePct, rrgLabel),
            direction.snapshot(transition, scorePct, signalDate),
            AlertStatus.ACTIVE));
    log.info(
        "{}: category={} score={} rrg={}", direction.ruleId, transition.categoryId(), scorePct, rrgLabel);
  }

  private boolean isBuy(BigDecimal score, int quadrant, BigDecimal trend) {
    return score != null
        && score.compareTo(BUY_SCORE_THRESHOLD) >= 0
        && (quadrant == 3 || quadrant == 4)
        && trend != null
        && trend.compareTo(BigDecimal.ZERO) > 0;
  }

  private boolean isReduce(BigDecimal score, int quadrant) {
    return score != null
        && score.compareTo(REDUCE_SCORE_THRESHOLD) < 0
        && (quadrant == 1 || quadrant == 2);
  }

  private int intValue(BigDecimal value) {
    return value != null ? value.intValue() : 0;
  }

  private Optional<CategoryId> knownCategory(String categoryId) {
    try {
      return Optional.of(CategoryId.valueOf(categoryId));
    } catch (IllegalArgumentException e) {
      return Optional.empty();
    }
  }

  private SignalWindow loadWindow(LocalDate date) {
    return new SignalWindow(
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, date),
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, date),
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, date));
  }

  private SignalWindow loadPreviousWindow(LocalDate signalDate) {
    LocalDate prevDate = signalRepository.findPreviousSignalDate(SignalType.COMPOSITE, signalDate);
    return prevDate != null ? loadWindow(prevDate) : SignalWindow.empty();
  }

  /** The composite / RRG / 20d-trend maps for a single date. */
  private record SignalWindow(
      Map<String, BigDecimal> composite,
      Map<String, BigDecimal> rrg,
      Map<String, BigDecimal> trend20d) {
    static SignalWindow empty() {
      return new SignalWindow(Map.of(), Map.of(), Map.of());
    }
  }

  /** A sector that transitioned into a BUY or REDUCE signal today. */
  private record Transition(
      String categoryId,
      CategoryId category,
      Direction direction,
      BigDecimal score,
      int quadrant,
      BigDecimal trend20d) {}

  private enum Direction {
    BUY(
        "trade_signal_buy",
        "%s full BUY signal triggered: score=%d, RRG=%s, 20d trend positive — all three conditions aligned"),
    REDUCE(
        "trade_signal_reduce",
        "%s REDUCE signal: score=%d with %s RRG — consider trimming position");

    private final String ruleId;
    private final String messageTemplate;

    Direction(String ruleId, String messageTemplate) {
      this.ruleId = ruleId;
      this.messageTemplate = messageTemplate;
    }

    String rrgLabel(int quadrant) {
      return this == BUY
          ? (quadrant == 4 ? "Leading" : "Improving")
          : (quadrant == 1 ? "Lagging" : "Weakening");
    }

    String message(String categoryId, int scorePct, String rrgLabel) {
      return String.format(messageTemplate, categoryId, scorePct, rrgLabel);
    }

    String snapshot(Transition transition, int scorePct, LocalDate signalDate) {
      return this == BUY
          ? String.format(
              "{\"score\":%d,\"rrgQuadrant\":%d,\"trend20d\":%.4f,\"signalDate\":\"%s\"}",
              scorePct, transition.quadrant(), transition.trend20d().doubleValue(), signalDate)
          : String.format(
              "{\"score\":%d,\"rrgQuadrant\":%d,\"signalDate\":\"%s\"}",
              scorePct, transition.quadrant(), signalDate);
    }
  }
}
