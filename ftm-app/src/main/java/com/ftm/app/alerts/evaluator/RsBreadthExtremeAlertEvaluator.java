package com.ftm.app.alerts.evaluator;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.AlertStatus;
import com.ftm.app.domain.Severity;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.ToIntFunction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * A market-wide breadth alert: fires BULL when a broad majority (≥60%) of equity sectors have RS-20
 * above RS-60 (short-term momentum alignment), and BEAR when a majority have RS-20 below RS-60
 * (broad deterioration). Each direction resolves when its fraction falls back below 45%.
 */
@Component
public class RsBreadthExtremeAlertEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(RsBreadthExtremeAlertEvaluator.class);

  private static final double RS_BREADTH_FIRE_FRACTION = 0.60;
  private static final double RS_BREADTH_RESOLVE_FRACTION = 0.45;

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public RsBreadthExtremeAlertEvaluator(
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
    Map<String, BigDecimal> rs20Map =
        signalRepository.findByTypeAndDate(SignalType.RS_20, signalDate);
    Map<String, BigDecimal> rs60Map =
        signalRepository.findByTypeAndDate(SignalType.RS_60, signalDate);
    if (rs20Map.isEmpty() || rs60Map.isEmpty()) {
      return 0;
    }

    Breadth breadth = computeBreadth(context.equityCategoryIds(), rs20Map, rs60Map);
    if (breadth.total() == 0) {
      return 0;
    }

    int fired = 0;
    if (bullEnabled) {
      fired += apply(Direction.BULL, breadth, bullRule.get().severity(), signalDate);
    }
    if (bearEnabled) {
      fired += apply(Direction.BEAR, breadth, bearRule.get().severity(), signalDate);
    }
    return fired;
  }

  private Breadth computeBreadth(
      Set<String> equityCategoryIds,
      Map<String, BigDecimal> rs20Map,
      Map<String, BigDecimal> rs60Map) {
    List<Integer> comparisons =
        equityCategoryIds.stream()
            .map(categoryId -> compare(rs20Map.get(categoryId), rs60Map.get(categoryId)))
            .flatMap(Optional::stream)
            .toList();
    long bull = comparisons.stream().filter(cmp -> cmp > 0).count();
    long bear = comparisons.stream().filter(cmp -> cmp < 0).count();
    return new Breadth(comparisons.size(), (int) bull, (int) bear);
  }

  private Optional<Integer> compare(BigDecimal rs20, BigDecimal rs60) {
    return rs20 == null || rs60 == null ? Optional.empty() : Optional.of(rs20.compareTo(rs60));
  }

  private int apply(Direction direction, Breadth breadth, Severity severity, LocalDate signalDate) {
    double fraction = direction.fraction(breadth);
    boolean active = alertRepository.existsActiveAlert(direction.ruleId, null);
    boolean shouldFire = fraction >= RS_BREADTH_FIRE_FRACTION && !active;
    boolean shouldResolve = fraction < RS_BREADTH_RESOLVE_FRACTION && active;
    if (shouldFire) {
      fire(direction, breadth, fraction, severity, signalDate);
      return 1;
    }
    if (shouldResolve) {
      resolve(direction, fraction);
    }
    return 0;
  }

  private void fire(
      Direction direction, Breadth breadth, double fraction, Severity severity, LocalDate signalDate) {
    int count = direction.count(breadth);
    alertRepository.insert(
        new Alert(
            OffsetDateTime.now(),
            null,
            direction.ruleId,
            severity,
            String.format(direction.messageTemplate, count, breadth.total(), fraction * 100),
            String.format(
                "{\"%s\":%d,\"total\":%d,\"fraction\":%.2f,\"signalDate\":\"%s\"}",
                direction.jsonCountKey, count, breadth.total(), fraction, signalDate),
            AlertStatus.ACTIVE));
    log.info("{}: {}={}/{} fraction={}", direction.ruleId, direction.jsonCountKey, count, breadth.total(), fraction);
  }

  private void resolve(Direction direction, double fraction) {
    alertRepository.resolveAlertsByRuleAndCategory(direction.ruleId, null);
    log.info("{}: resolved, fraction dropped to {}", direction.ruleId, fraction);
  }

  /** Market-wide breadth tallies for the day. */
  private record Breadth(int total, int bullCount, int bearCount) {}

  private enum Direction {
    BULL(
        "rs_breadth_bull",
        "bullCount",
        "RS BREADTH BULL: %d/%d equity sectors (%.0f%%) have RS-20 > RS-60 — broad short-term momentum alignment",
        Breadth::bullCount),
    BEAR(
        "rs_breadth_bear",
        "bearCount",
        "RS BREADTH BEAR: %d/%d equity sectors (%.0f%%) have RS-20 < RS-60 — broad momentum deterioration across market",
        Breadth::bearCount);

    private final String ruleId;
    private final String jsonCountKey;
    private final String messageTemplate;
    private final ToIntFunction<Breadth> countExtractor;

    Direction(
        String ruleId,
        String jsonCountKey,
        String messageTemplate,
        ToIntFunction<Breadth> countExtractor) {
      this.ruleId = ruleId;
      this.jsonCountKey = jsonCountKey;
      this.messageTemplate = messageTemplate;
      this.countExtractor = countExtractor;
    }

    int count(Breadth breadth) {
      return countExtractor.applyAsInt(breadth);
    }

    double fraction(Breadth breadth) {
      return (double) count(breadth) / breadth.total();
    }
  }
}
