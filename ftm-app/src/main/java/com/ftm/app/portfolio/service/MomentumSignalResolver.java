package com.ftm.app.portfolio.service;

import com.ftm.app.category.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryType;
import com.ftm.app.signals.service.MomentumTradeSignalDeriver;
import java.math.BigDecimal;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Single source of truth for the momentum view of the portfolio: what each top-level category's
 * 12-1 momentum is, which categories the strategy would hold, and the resulting BUY/HOLD/REDUCE
 * signal.
 *
 * <p>This exists because two portfolio surfaces need the same answer. {@code /portfolio} builds the
 * optimal allocation and rebalance suggestions from momentum, while {@code /portfolio/actions}
 * labels each holding. When those derived the signal separately they disagreed — the optimal said
 * "increase TECH" while every holding read HOLD, because actions were still reading the composite
 * signal. Both now call this, so they cannot drift apart again.
 *
 * <p>Deliberately NOT the app-wide trade signal: the dashboard, sector cards, themes and alerts
 * still run on the composite model. Only the portfolio surfaces use momentum.
 */
@Component
public class MomentumSignalResolver {

  /**
   * @param momentumByCategoryId 12-1 momentum for every top-level category (a return, e.g. 0.14 =
   *     +14%); a category is absent when there is not enough price history
   * @param optimalAllocationByCategoryId target weights for the selected top-N; its key set IS the
   *     selection
   * @param tradeSignalByCategoryId BUY/HOLD/REDUCE per top-level category
   */
  public record MomentumSignals(
      Map<String, BigDecimal> momentumByCategoryId,
      Map<String, BigDecimal> optimalAllocationByCategoryId,
      Map<String, String> tradeSignalByCategoryId) {}

  private final CategoryRepository categoryRepository;
  private final LiveMomentumScoreService liveMomentumScoreService;
  private final AlignmentService alignmentService;

  public MomentumSignalResolver(
      CategoryRepository categoryRepository,
      LiveMomentumScoreService liveMomentumScoreService,
      AlignmentService alignmentService) {
    this.categoryRepository = categoryRepository;
    this.liveMomentumScoreService = liveMomentumScoreService;
    this.alignmentService = alignmentService;
  }

  /**
   * Momentum signals over the default (equity-sector) selection universe, loading the top-level
   * categories itself — for callers that do not already hold them.
   */
  public MomentumSignals resolve() {
    return resolve(loadTopLevelCategoriesById(), PortfolioSelectionUniverse.EQUITY_SECTORS);
  }

  public MomentumSignals resolve(
      Map<String, Category> topLevelCategoriesById, PortfolioSelectionUniverse selectionUniverse) {

    Map<String, BigDecimal> momentumByCategoryId =
        liveMomentumScoreService.computeLatestMomentumByCategoryId().entrySet().stream()
            .filter(entry -> topLevelCategoriesById.containsKey(entry.getKey()))
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

    Map<String, BigDecimal> optimalAllocationByCategoryId =
        alignmentService.computeMomentumRankOptimalAllocation(
            selectionMomentum(momentumByCategoryId, topLevelCategoriesById, selectionUniverse),
            selectionUniverse.holdCount());

    // Momentum is derived for EVERY top-level category, not just the selection universe, so a
    // holding in gold or bonds still gets a real HOLD/REDUCE rather than falling through as
    // unclassified. Only the selection (BUY) is restricted to the universe.
    Map<String, String> tradeSignalByCategoryId =
        momentumByCategoryId.entrySet().stream()
            .collect(
                Collectors.toMap(
                    Map.Entry::getKey,
                    entry ->
                        MomentumTradeSignalDeriver.derive(
                            entry.getValue(),
                            optimalAllocationByCategoryId.containsKey(entry.getKey()))));

    return new MomentumSignals(
        momentumByCategoryId, optimalAllocationByCategoryId, tradeSignalByCategoryId);
  }

  /**
   * The universe the top-N selection ranks over. EQUITY_SECTORS (default) is where momentum's edge
   * validated cleanly; ALL_TOP_LEVEL adds metals and bonds for dual-momentum rotation.
   */
  private Map<String, BigDecimal> selectionMomentum(
      Map<String, BigDecimal> momentumByCategoryId,
      Map<String, Category> topLevelCategoriesById,
      PortfolioSelectionUniverse selectionUniverse) {

    if (selectionUniverse != PortfolioSelectionUniverse.EQUITY_SECTORS) {
      return momentumByCategoryId;
    }
    return momentumByCategoryId.entrySet().stream()
        .filter(
            entry -> topLevelCategoriesById.get(entry.getKey()).type() == CategoryType.EQUITY_SECTOR)
        .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
  }

  private Map<String, Category> loadTopLevelCategoriesById() {
    return categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc().stream()
        .filter(category -> category.parentId() == null)
        .collect(Collectors.toMap(category -> category.id().name(), category -> category));
  }
}
