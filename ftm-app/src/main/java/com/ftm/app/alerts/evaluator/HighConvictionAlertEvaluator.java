package com.ftm.app.alerts.evaluator;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.api.service.TradeSignalDeriver;
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
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * The high-conviction cluster of alerts, all driven by {@link TradeSignalDeriver} conviction scores
 * over the latest signal snapshot:
 *
 * <ul>
 *   <li><b>high_conviction_buy</b> — per sector, fires when conviction ≥75 and resolves below 65.
 *   <li><b>high_conviction_cluster</b> — market-wide, fires when ≥3 sectors are at conviction ≥75
 *       (broad RISK-ON), resolves below 2.
 *   <li><b>high_conviction_reduce_cluster</b> — market-wide, fires when ≥3 sectors carry a REDUCE
 *       signal at conviction ≥40 (broad RISK-OFF rotation), resolves below 2.
 * </ul>
 *
 * The conviction signal snapshot is fetched once and shared across all three checks.
 */
@Component
public class HighConvictionAlertEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(HighConvictionAlertEvaluator.class);

  private static final String RULE_HIGH_CONVICTION_BUY = "high_conviction_buy";
  private static final String RULE_HIGH_CONVICTION_CLUSTER = "high_conviction_cluster";
  private static final String RULE_HIGH_CONVICTION_REDUCE_CLUSTER = "high_conviction_reduce_cluster";

  private static final int HIGH_CONVICTION_THRESHOLD = 75;
  private static final int HIGH_CONVICTION_RESOLVE_THRESHOLD = 65;
  private static final int CLUSTER_MIN_SIZE = 3;
  private static final int CLUSTER_RESOLVE_SIZE = 2;
  private static final int REDUCE_CLUSTER_CONVICTION_THRESHOLD = 40;
  private static final BigDecimal ONE_HUNDRED = BigDecimal.valueOf(100);

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public HighConvictionAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    Optional<AlertRule> buyRule = alertRulesRepository.findById(RULE_HIGH_CONVICTION_BUY);
    Optional<AlertRule> clusterRule = alertRulesRepository.findById(RULE_HIGH_CONVICTION_CLUSTER);
    Optional<AlertRule> reduceClusterRule =
        alertRulesRepository.findById(RULE_HIGH_CONVICTION_REDUCE_CLUSTER);
    boolean buyEnabled = buyRule.map(AlertRule::enabled).orElse(false);
    boolean clusterEnabled = clusterRule.map(AlertRule::enabled).orElse(false);
    boolean reduceClusterEnabled = reduceClusterRule.map(AlertRule::enabled).orElse(false);
    if (!buyEnabled && !clusterEnabled && !reduceClusterEnabled) return 0;

    // The snapshot is identical for all three checks — fetch it once.
    ConvictionSignalMaps maps = fetchConvictionSignals();
    LocalDate signalDate = context.signalDate();

    int count = 0;
    if (buyEnabled) {
      count += evaluateBuy(context, maps, buyRule.get().severity(), signalDate);
    }
    if (clusterEnabled) {
      count += evaluateCluster(context, maps, clusterRule.get().severity(), signalDate);
    }
    if (reduceClusterEnabled) {
      count += evaluateReduceCluster(context, maps, reduceClusterRule.get().severity(), signalDate);
    }
    return count;
  }

  private int evaluateBuy(
      AlertEvaluationContext context,
      ConvictionSignalMaps maps,
      Severity severity,
      LocalDate signalDate) {
    int count = 0;
    for (String categoryId : context.topLevelCategoryIds()) {
      BigDecimal score = maps.composite().get(categoryId);
      if (score == null) continue;

      BigDecimal rrg = maps.rrg().get(categoryId);
      BigDecimal macroFit = maps.macroFit().get(categoryId);
      BigDecimal percentile = maps.percentile252d().get(categoryId);
      int conviction = convictionScore(maps, categoryId, score);
      boolean hasActiveAlert = alertRepository.existsActiveAlert(RULE_HIGH_CONVICTION_BUY, categoryId);

      if (conviction >= HIGH_CONVICTION_THRESHOLD && !hasActiveAlert) {
        CategoryId catId = parseCategory(categoryId);
        if (catId == null) continue;
        int scorePct = toPercent(score);
        int macroPct = macroFit != null ? toPercent(macroFit) : 0;
        int pctRank = percentile != null ? toPercent(percentile) : 0;
        String rrgLabel = buyRrgLabel(rrg);
        alertRepository.insert(
            new Alert(
                OffsetDateTime.now(),
                catId,
                RULE_HIGH_CONVICTION_BUY,
                severity,
                String.format(
                    "%s high-conviction BUY — conviction %d/100: score=%d, macro fit=%d%%, 252d rank=P%d, RRG %s",
                    categoryId, conviction, scorePct, macroPct, pctRank, rrgLabel),
                String.format(
                    "{\"conviction\":%d,\"score\":%d,\"macroFitPct\":%d,\"percentile252d\":%d,\"rrgQuadrant\":\"%s\",\"signalDate\":\"%s\"}",
                    conviction, scorePct, macroPct, pctRank, rrgLabel, signalDate),
                AlertStatus.ACTIVE));
        count++;
        log.info(
            "high_conviction_buy: category={} conviction={} score={} macroFit={}% P252={}",
            categoryId, conviction, scorePct, macroPct, pctRank);
      } else if (conviction < HIGH_CONVICTION_RESOLVE_THRESHOLD && hasActiveAlert) {
        alertRepository.resolveAlertsByRuleAndCategory(RULE_HIGH_CONVICTION_BUY, categoryId);
      }
    }
    return count;
  }

  private int evaluateCluster(
      AlertEvaluationContext context,
      ConvictionSignalMaps maps,
      Severity severity,
      LocalDate signalDate) {
    List<String> highConvictionIds = new ArrayList<>();
    for (String categoryId : context.topLevelCategoryIds()) {
      BigDecimal score = maps.composite().get(categoryId);
      if (score == null) continue;
      if (convictionScore(maps, categoryId, score) >= HIGH_CONVICTION_THRESHOLD) {
        highConvictionIds.add(categoryId);
      }
    }

    int clusterSize = highConvictionIds.size();
    boolean hasActiveAlert = alertRepository.existsActiveAlert(RULE_HIGH_CONVICTION_CLUSTER, null);

    if (clusterSize >= CLUSTER_MIN_SIZE && !hasActiveAlert) {
      String tickers = topFive(highConvictionIds);
      alertRepository.insert(
          new Alert(
              OffsetDateTime.now(),
              null,
              RULE_HIGH_CONVICTION_CLUSTER,
              severity,
              String.format(
                  "HIGH CONVICTION CLUSTER: %d sectors at conviction ≥%d — broad RISK-ON regime confirmed (%s)",
                  clusterSize, HIGH_CONVICTION_THRESHOLD, tickers),
              String.format(
                  "{\"clusterSize\":%d,\"sectors\":\"%s\",\"signalDate\":\"%s\"}",
                  clusterSize, tickers, signalDate),
              AlertStatus.ACTIVE));
      log.info("high_conviction_cluster: clusterSize={} sectors={}", clusterSize, tickers);
      return 1;
    } else if (clusterSize < CLUSTER_RESOLVE_SIZE && hasActiveAlert) {
      alertRepository.resolveAlertsByRuleAndCategory(RULE_HIGH_CONVICTION_CLUSTER, null);
      log.info("high_conviction_cluster: resolved, clusterSize dropped to {}", clusterSize);
    }
    return 0;
  }

  private int evaluateReduceCluster(
      AlertEvaluationContext context,
      ConvictionSignalMaps maps,
      Severity severity,
      LocalDate signalDate) {
    List<String> reduceClusterIds = new ArrayList<>();
    for (String categoryId : context.topLevelCategoryIds()) {
      BigDecimal score = maps.composite().get(categoryId);
      if (score == null) continue;
      String rrgStr = rrgString(maps, categoryId);
      String signal = TradeSignalDeriver.derive(score, rrgStr, maps.trend20d().get(categoryId));
      if (!"REDUCE".equals(signal)) continue;
      if (convictionScore(maps, categoryId, score) >= REDUCE_CLUSTER_CONVICTION_THRESHOLD) {
        reduceClusterIds.add(categoryId);
      }
    }

    int clusterSize = reduceClusterIds.size();
    boolean hasActiveAlert =
        alertRepository.existsActiveAlert(RULE_HIGH_CONVICTION_REDUCE_CLUSTER, null);

    if (clusterSize >= CLUSTER_MIN_SIZE && !hasActiveAlert) {
      String tickers = topFive(reduceClusterIds);
      alertRepository.insert(
          new Alert(
              OffsetDateTime.now(),
              null,
              RULE_HIGH_CONVICTION_REDUCE_CLUSTER,
              severity,
              String.format(
                  "REDUCE CLUSTER: %d sectors at conviction ≥%d — broad RISK-OFF rotation detected (%s)",
                  clusterSize, REDUCE_CLUSTER_CONVICTION_THRESHOLD, tickers),
              String.format(
                  "{\"clusterSize\":%d,\"sectors\":\"%s\",\"signalDate\":\"%s\"}",
                  clusterSize, tickers, signalDate),
              AlertStatus.ACTIVE));
      log.info("high_conviction_reduce_cluster: clusterSize={} sectors={}", clusterSize, tickers);
      return 1;
    } else if (clusterSize < CLUSTER_RESOLVE_SIZE && hasActiveAlert) {
      alertRepository.resolveAlertsByRuleAndCategory(RULE_HIGH_CONVICTION_REDUCE_CLUSTER, null);
      log.info("high_conviction_reduce_cluster: resolved, clusterSize dropped to {}", clusterSize);
    }
    return 0;
  }

  private int convictionScore(ConvictionSignalMaps maps, String categoryId, BigDecimal score) {
    return TradeSignalDeriver.convictionScore(
        score,
        rrgString(maps, categoryId),
        maps.trend20d().get(categoryId),
        maps.macroFit().get(categoryId),
        maps.percentile252d().get(categoryId),
        maps.trend5d().get(categoryId),
        maps.rs60().get(categoryId),
        maps.rs120().get(categoryId),
        maps.flow20d().get(categoryId),
        maps.rs20().get(categoryId));
  }

  private String rrgString(ConvictionSignalMaps maps, String categoryId) {
    BigDecimal rrg = maps.rrg().get(categoryId);
    return rrg != null ? String.valueOf(rrg.intValue()) : null;
  }

  private String buyRrgLabel(BigDecimal rrg) {
    if (rrg == null) return "Unknown";
    return switch (rrg.intValue()) {
      case 4 -> "Leading";
      case 3 -> "Improving";
      default -> "Q" + rrg.intValue();
    };
  }

  private CategoryId parseCategory(String categoryId) {
    try {
      return CategoryId.valueOf(categoryId);
    } catch (IllegalArgumentException e) {
      log.debug("high_conviction_buy: skipping unknown CategoryId={}", categoryId);
      return null;
    }
  }

  private int toPercent(BigDecimal value) {
    return value.multiply(ONE_HUNDRED).intValue();
  }

  private String topFive(List<String> ids) {
    return String.join(", ", ids.stream().sorted().limit(5).toList());
  }

  private ConvictionSignalMaps fetchConvictionSignals() {
    Map<SignalType, Map<String, BigDecimal>> signals =
        signalRepository.findLatestByTypes(
            List.of(
                SignalType.COMPOSITE,
                SignalType.RRG_QUADRANT,
                SignalType.COMPOSITE_TREND_20D,
                SignalType.MACRO_FIT,
                SignalType.COMPOSITE_TREND_5D,
                SignalType.RS_60,
                SignalType.RS_120,
                SignalType.FLOW_20D,
                SignalType.RS_20));
    return new ConvictionSignalMaps(
        signals.getOrDefault(SignalType.COMPOSITE, Collections.emptyMap()),
        signals.getOrDefault(SignalType.RRG_QUADRANT, Collections.emptyMap()),
        signals.getOrDefault(SignalType.COMPOSITE_TREND_20D, Collections.emptyMap()),
        signals.getOrDefault(SignalType.MACRO_FIT, Collections.emptyMap()),
        signals.getOrDefault(SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()),
        signals.getOrDefault(SignalType.RS_60, Collections.emptyMap()),
        signals.getOrDefault(SignalType.RS_120, Collections.emptyMap()),
        signals.getOrDefault(SignalType.FLOW_20D, Collections.emptyMap()),
        signals.getOrDefault(SignalType.RS_20, Collections.emptyMap()),
        signalRepository.findScorePercentile252d());
  }

  /** The latest signal snapshot needed to compute conviction scores. */
  private record ConvictionSignalMaps(
      Map<String, BigDecimal> composite,
      Map<String, BigDecimal> rrg,
      Map<String, BigDecimal> trend20d,
      Map<String, BigDecimal> macroFit,
      Map<String, BigDecimal> trend5d,
      Map<String, BigDecimal> rs60,
      Map<String, BigDecimal> rs120,
      Map<String, BigDecimal> flow20d,
      Map<String, BigDecimal> rs20,
      Map<String, BigDecimal> percentile252d) {}
}
