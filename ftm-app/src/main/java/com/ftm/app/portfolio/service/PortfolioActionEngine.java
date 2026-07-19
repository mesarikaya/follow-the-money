package com.ftm.app.portfolio.service;

import com.ftm.app.api.dto.CategorySummaryDto;
import com.ftm.app.api.dto.HoldingActionDto;
import com.ftm.app.api.dto.HoldingDto;
import com.ftm.app.signals.service.TradeSignalDeriver;
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
 *   <li>3 ADD — BUY signal: the sector is in the top-N momentum selection, so the strategy wants
 *       more of it, not merely to keep it
 *   <li>4 HOLD — HOLD signal (positive momentum but outside the top-N; keep, don't add)
 *   <li>5 UNCLASSIFIED — holding has no FTM category mapping
 * </ul>
 *
 * <p>There is no WATCH tier: it belonged to the composite model's "improving but not yet BUY-grade"
 * state, which the momentum model does not have.
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
    return deriveActions(holdings, categoriesById, Map.of(), Map.of(), totalPortfolioEur);
  }

  /**
   * Derives an ordered action list for the given holdings.
   *
   * @param holdings current portfolio holdings
   * @param categoriesById CategorySummaryDto map keyed by top-level categoryId string
   * @param parentByCategoryId categoryId→parentId map used to roll a holding's sub-category (e.g.
   *     INDU_ADEF, SEMI) up to its parent sector so it isn't reported UNCLASSIFIED
   * @param momentumSignalByCategoryId BUY/HOLD/REDUCE per top-level category from {@link
   *     MomentumSignalResolver}. This is what makes the action list agree with the optimal
   *     allocation on {@code /portfolio}; pass an empty map to fall back to the composite signal
   *     carried on the category summary.
   * @param totalPortfolioEur total portfolio EUR value; must be positive
   * @return actions sorted by urgency ascending (EXIT first)
   */
  public List<HoldingActionDto> deriveActions(
      List<HoldingDto> holdings,
      Map<String, CategorySummaryDto> categoriesById,
      Map<String, String> parentByCategoryId,
      Map<String, String> momentumSignalByCategoryId,
      BigDecimal totalPortfolioEur) {

    return holdings.stream()
        .map(
            holding ->
                toAction(
                    holding,
                    categoriesById,
                    parentByCategoryId,
                    momentumSignalByCategoryId,
                    totalPortfolioEur))
        .sorted(Comparator.comparingInt(HoldingActionDto::urgency))
        .toList();
  }

  private HoldingActionDto toAction(
      HoldingDto holding,
      Map<String, CategorySummaryDto> categoriesById,
      Map<String, String> parentByCategoryId,
      Map<String, String> momentumSignalByCategoryId,
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

    String signal = resolveSignal(category, momentumSignalByCategoryId.get(resolvedCategoryId));
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

  /**
   * The momentum signal wins when present: it is the model the portfolio's optimal allocation is
   * built from, and disagreeing with it is the bug this parameter exists to fix. The composite
   * fallbacks below only apply to callers that pass no momentum map (and to categories with too
   * little price history to score).
   */
  private String resolveSignal(CategorySummaryDto category, String momentumSignal) {
    if (momentumSignal != null) {
      return momentumSignal;
    }
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
    if ("BUY".equals(signal)) return 3;
    // Everything else — HOLD, and a composite-fallback WATCH — is "keep it, do nothing".
    return 4;
  }

  private String actionLabel(int urgency) {
    return switch (urgency) {
      case 1 -> "EXIT";
      case 2 -> "TRIM";
      case 3 -> "ADD";
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
            + " has negative 12-1 momentum — the absolute-momentum exit; a falling sector is not"
            + " held regardless of its rank"
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
              + " is among the top-ranked sectors by 12-1 momentum"
              + (conviction != null && conviction > 0 ? " (conviction: " + conviction + ")" : "")
              + " — the strategy targets it; add toward its optimal weight.";
      default ->
          categoryName
              + " has positive 12-1 momentum but sits outside the top-ranked selection — keep the"
              + " position, don't add to it.";
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
