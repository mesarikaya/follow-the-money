package com.ftm.app.api.service;

import com.ftm.app.api.dto.CategorySummaryDto;
import com.ftm.app.api.dto.HoldingActionDto;
import com.ftm.app.api.dto.HoldingDto;
import com.ftm.app.portfolio.service.CategoryHierarchyResolver;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Pure, stateless decision engine that derives recommended actions for each holding by
 * cross-referencing signal data from the CategorySummaryDto map.
 *
 * <p>Urgency tiers (lower = more urgent):
 *
 * <ul>
 *   <li>1 EXIT — REDUCE signal AND position is &gt;5% of portfolio (meaningful drawdown risk)
 *   <li>2 TRIM — REDUCE signal, smaller position (trim before it grows)
 *   <li>3 WATCH — WATCH signal (no immediate action; monitor for deterioration)
 *   <li>4 HOLD — BUY or HOLD signal (signal is positive; ride it)
 *   <li>5 UNCLASSIFIED — holding has no FTM category mapping
 * </ul>
 */
@Component
public class PortfolioActionEngine {

  private static final BigDecimal EXIT_THRESHOLD_PCT = new BigDecimal("5.00");
  private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

  private final CategoryHierarchyResolver categoryHierarchyResolver;

  public PortfolioActionEngine(CategoryHierarchyResolver categoryHierarchyResolver) {
    this.categoryHierarchyResolver = categoryHierarchyResolver;
  }

  /**
   * No-hierarchy overload — resolves categories by direct lookup only (no sub-category roll-up).
   */
  public List<HoldingActionDto> deriveActions(
      List<HoldingDto> holdings,
      Map<String, CategorySummaryDto> categoriesById,
      BigDecimal totalPortfolioEur) {
    return deriveActions(holdings, categoriesById, Map.of(), totalPortfolioEur);
  }

  /**
   * Derives an ordered action list for the given holdings.
   *
   * @param holdings current portfolio holdings
   * @param categoriesById CategorySummaryDto map keyed by top-level categoryId string
   * @param parentByCategoryId categoryId→parentId map used to roll a holding's sub-category (e.g.
   *     INDU_ADEF, SEMI) up to its parent sector so it isn't reported UNCLASSIFIED
   * @param totalPortfolioEur total portfolio EUR value; must be positive
   * @return actions sorted by urgency ascending (EXIT first)
   */
  public List<HoldingActionDto> deriveActions(
      List<HoldingDto> holdings,
      Map<String, CategorySummaryDto> categoriesById,
      Map<String, String> parentByCategoryId,
      BigDecimal totalPortfolioEur) {

    return holdings.stream()
        .map(holding -> toAction(holding, categoriesById, parentByCategoryId, totalPortfolioEur))
        .sorted(Comparator.comparingInt(HoldingActionDto::urgency))
        .toList();
  }

  private HoldingActionDto toAction(
      HoldingDto holding,
      Map<String, CategorySummaryDto> categoriesById,
      Map<String, String> parentByCategoryId,
      BigDecimal totalPortfolioEur) {

    // A holding tagged with a sub-category (INDU_ADEF, SEMI, ...) resolves to its parent sector's
    // summary, which is what the top-level category map contains.
    String resolvedCategoryId =
        holding.categoryId() != null
            ? categoryHierarchyResolver.topLevelAncestorId(holding.categoryId(), parentByCategoryId)
            : null;
    CategorySummaryDto category =
        resolvedCategoryId != null ? categoriesById.get(resolvedCategoryId) : null;

    BigDecimal portfolioPct = computePortfolioPct(holding.marketValueEur(), totalPortfolioEur);

    if (category == null) {
      return unclassified(holding, portfolioPct);
    }

    String signal = resolveSignal(category);
    int urgency = urgencyFor(signal, portfolioPct);
    String action = actionLabel(urgency);
    String rationale = buildRationale(signal, portfolioPct, category);

    return new HoldingActionDto(
        holding.ticker(),
        holding.name(),
        category.id() != null ? category.id().name() : holding.categoryId(),
        category.name(),
        signal,
        category.convictionScore(),
        action,
        rationale,
        portfolioPct,
        urgency);
  }

  private String resolveSignal(CategorySummaryDto category) {
    if (category.tradeSignal() != null) {
      return category.tradeSignal();
    }
    return TradeSignalDeriver.derive(
        category.compositeScore(), category.rrgQuadrant(), category.compositeTrend20d());
  }

  private int urgencyFor(String signal, BigDecimal portfolioPct) {
    if ("REDUCE".equals(signal)) {
      boolean oversized = portfolioPct != null && portfolioPct.compareTo(EXIT_THRESHOLD_PCT) > 0;
      return oversized ? 1 : 2;
    }
    if ("WATCH".equals(signal)) return 3;
    return 4;
  }

  private String actionLabel(int urgency) {
    return switch (urgency) {
      case 1 -> "EXIT";
      case 2 -> "TRIM";
      case 3 -> "WATCH";
      default -> "HOLD";
    };
  }

  private String buildRationale(
      String signal, BigDecimal portfolioPct, CategorySummaryDto category) {
    String categoryName = category.name() != null ? category.name() : "this sector";
    Integer conviction = category.convictionScore();

    return switch (signal != null ? signal : "HOLD") {
      case "REDUCE" -> {
        String sizeContext =
            portfolioPct != null
                ? " (" + portfolioPct.setScale(1, RoundingMode.HALF_UP) + "% of portfolio)"
                : "";
        yield categoryName
            + sizeContext
            + " is under REDUCE signal — selling pressure and weakening relative strength"
            + (conviction != null && conviction > 0 ? "; conviction: " + conviction : "")
            + ".";
      }
      case "WATCH" ->
          categoryName
              + " is on WATCH — signal improving but not yet BUY-grade; hold and reassess next week"
              + (conviction != null && conviction > 0 ? " (conviction: " + conviction + ")" : "")
              + ".";
      case "BUY" ->
          categoryName
              + " has an active BUY signal"
              + (conviction != null && conviction > 0 ? " (conviction: " + conviction + ")" : "")
              + " — maintain or add to position.";
      default -> categoryName + " is neutral; no strong directional signal — hold and monitor.";
    };
  }

  private BigDecimal computePortfolioPct(BigDecimal marketValueEur, BigDecimal totalEur) {
    if (marketValueEur == null || totalEur == null || totalEur.compareTo(BigDecimal.ZERO) == 0) {
      return null;
    }
    return marketValueEur.multiply(HUNDRED).divide(totalEur, 2, RoundingMode.HALF_UP);
  }

  private HoldingActionDto unclassified(HoldingDto holding, BigDecimal portfolioPct) {
    return new HoldingActionDto(
        holding.ticker(),
        holding.name(),
        null,
        null,
        null,
        null,
        "UNCLASSIFIED",
        holding.ticker() + " has no FTM sector mapping — review allocation manually.",
        portfolioPct,
        5);
  }
}
