package com.ftm.app.portfolio.service;

import com.ftm.app.api.dto.PortfolioEntryDto;
import com.ftm.app.api.dto.PortfolioResponse;
import com.ftm.app.api.dto.PortfolioResponse.PortfolioAllocationEntry;
import com.ftm.app.api.dto.RebalanceSuggestionDto;
import com.ftm.app.category.repository.CategoryRepository;
import com.ftm.app.signals.service.MomentumTradeSignalDeriver;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.CategoryType;
import com.ftm.app.domain.Portfolio;
import com.ftm.app.domain.SignalType;
import com.ftm.app.portfolio.repository.PortfolioRepository;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class PortfolioService {

  private static final Logger log = LoggerFactory.getLogger(PortfolioService.class);

  private static final BigDecimal TOTAL_ALLOCATION_EXPECTED = new BigDecimal("100");
  private static final BigDecimal ALLOCATION_TOLERANCE = new BigDecimal("0.5");
  private static final BigDecimal ALIGNMENT_SCORE_GREEN_THRESHOLD = new BigDecimal("0.70");
  private static final BigDecimal ALIGNMENT_SCORE_YELLOW_THRESHOLD = new BigDecimal("0.40");

  private static final BigDecimal HUNDRED = new BigDecimal("100");

  private final PortfolioRepository portfolioRepository;
  private final CategoryRepository categoryRepository;
  private final SignalRepository signalRepository;
  private final AlignmentService alignmentService;
  private final CategoryHierarchyResolver categoryHierarchyResolver;
  private final LiveMomentumScoreService liveMomentumScoreService;

  public PortfolioService(
      PortfolioRepository portfolioRepository,
      CategoryRepository categoryRepository,
      SignalRepository signalRepository,
      AlignmentService alignmentService,
      CategoryHierarchyResolver categoryHierarchyResolver,
      LiveMomentumScoreService liveMomentumScoreService) {
    this.portfolioRepository = portfolioRepository;
    this.categoryRepository = categoryRepository;
    this.signalRepository = signalRepository;
    this.alignmentService = alignmentService;
    this.categoryHierarchyResolver = categoryHierarchyResolver;
    this.liveMomentumScoreService = liveMomentumScoreService;
  }

  /** Portfolio view with recommendations from the default (equity-sector) selection universe. */
  public PortfolioResponse getPortfolio() {
    return getPortfolio(PortfolioSelectionUniverse.EQUITY_SECTORS);
  }

  public PortfolioResponse getPortfolio(PortfolioSelectionUniverse selectionUniverse) {
    List<Category> allCategories = categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc();

    Map<String, Category> categoriesById =
        allCategories.stream()
            .filter(c -> c.parentId() == null)
            .collect(Collectors.toMap(c -> c.id().name(), c -> c));

    Map<String, String> parentByCategoryId = new HashMap<>();
    allCategories.forEach(c -> parentByCategoryId.put(c.id().name(), c.parentId()));

    // Roll sub-category positions (e.g. INDU_ADEF, SEMI) up into their parent sector so allocations
    // sum to 100% rather than dropping the sub-category value.
    Map<String, BigDecimal> rawAllocationByCategoryId =
        portfolioRepository.findAll().stream()
            .collect(Collectors.toMap(p -> p.categoryId().name(), Portfolio::allocationPct));
    Map<String, BigDecimal> currentAllocationByCategoryId =
        categoryHierarchyResolver.rollUpToTopLevel(rawAllocationByCategoryId, parentByCategoryId);

    // Composite score is kept for on-page context only; it no longer drives the recommendations.
    Map<String, BigDecimal> compositeScoreByCategoryId =
        signalRepository.findLatestByType(SignalType.COMPOSITE);

    // Live 12-1 momentum drives the recommendations — the signal that beat the composite
    // out-of-sample (the composite's top-ranked pick was historically its worst). Computed for every
    // top-level category (shown in the table), but see the selection universe below.
    Map<String, BigDecimal> topLevelMomentumByCategoryId =
        liveMomentumScoreService.computeLatestMomentumByCategoryId().entrySet().stream()
            .filter(e -> categoriesById.containsKey(e.getKey()))
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

    // Selection universe drives the optimal. EQUITY_SECTORS (default) is where momentum's edge
    // validated cleanly (top-3 Sharpe ~0.96); ALL_TOP_LEVEL adds gold/metals/bonds for dual-momentum
    // rotation (top-5 — more names to tame metals whipsaw). Either way the absolute-momentum filter
    // rotates to cash when nothing in the universe has positive momentum.
    Map<String, BigDecimal> selectionMomentumByCategoryId =
        selectionUniverse == PortfolioSelectionUniverse.EQUITY_SECTORS
            ? topLevelMomentumByCategoryId.entrySet().stream()
                .filter(e -> categoriesById.get(e.getKey()).type() == CategoryType.EQUITY_SECTOR)
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue))
            : topLevelMomentumByCategoryId;

    Map<String, BigDecimal> optimalAllocationByCategoryId =
        alignmentService.computeMomentumRankOptimalAllocation(
            selectionMomentumByCategoryId, selectionUniverse.holdCount());

    BigDecimal alignmentScore =
        alignmentService.computeAlignmentScoreAgainstOptimal(
            currentAllocationByCategoryId, optimalAllocationByCategoryId);

    String alignmentLabel = resolveAlignmentLabel(alignmentScore);

    List<PortfolioAllocationEntry> allocationEntries =
        categoriesById.values().stream()
            .map(
                category -> {
                  String categoryId = category.id().name();
                  BigDecimal momentum = topLevelMomentumByCategoryId.get(categoryId);
                  boolean selected = optimalAllocationByCategoryId.containsKey(categoryId);
                  return new PortfolioAllocationEntry(
                      categoryId,
                      category.name(),
                      category.type().name(),
                      currentAllocationByCategoryId.getOrDefault(categoryId, BigDecimal.ZERO),
                      compositeScoreByCategoryId.get(categoryId),
                      toPercent(momentum),
                      optimalAllocationByCategoryId.get(categoryId),
                      MomentumTradeSignalDeriver.derive(momentum, selected));
                })
            .sorted(Comparator.comparing(PortfolioAllocationEntry::categoryId))
            .toList();

    List<RebalanceSuggestionDto> rebalanceSuggestions =
        buildRebalanceSuggestions(
            categoriesById,
            currentAllocationByCategoryId,
            optimalAllocationByCategoryId,
            topLevelMomentumByCategoryId);

    log.debug(
        "Portfolio loaded: {} allocations, alignment={}", allocationEntries.size(), alignmentScore);
    return new PortfolioResponse(
        allocationEntries, alignmentScore, alignmentLabel, rebalanceSuggestions);
  }

  public void savePortfolio(List<PortfolioEntryDto> entries) {
    validateAllocationSum(entries);

    List<Portfolio> portfolioEntries =
        entries.stream()
            .map(
                dto ->
                    new Portfolio(
                        CategoryId.valueOf(dto.categoryId()),
                        dto.allocationPct(),
                        OffsetDateTime.now(),
                        null))
            .toList();

    portfolioRepository.replaceAll(portfolioEntries);
    log.info("Portfolio saved: {} category allocations", portfolioEntries.size());
  }

  private void validateAllocationSum(List<PortfolioEntryDto> entries) {
    BigDecimal totalAllocation =
        entries.stream()
            .map(PortfolioEntryDto::allocationPct)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

    BigDecimal deviation = totalAllocation.subtract(TOTAL_ALLOCATION_EXPECTED).abs();
    if (deviation.compareTo(ALLOCATION_TOLERANCE) > 0) {
      throw new IllegalArgumentException(
          String.format(
              "Portfolio allocations must sum to 100%% (±0.5%%). Got: %.2f%%", totalAllocation));
    }
  }

  private String resolveAlignmentLabel(BigDecimal alignmentScore) {
    if (alignmentScore.compareTo(ALIGNMENT_SCORE_GREEN_THRESHOLD) >= 0) return "ALIGNED";
    if (alignmentScore.compareTo(ALIGNMENT_SCORE_YELLOW_THRESHOLD) >= 0) return "PARTIAL";
    return "MISALIGNED";
  }

  private List<RebalanceSuggestionDto> buildRebalanceSuggestions(
      Map<String, Category> categoriesById,
      Map<String, BigDecimal> currentAllocationByCategoryId,
      Map<String, BigDecimal> optimalAllocationByCategoryId,
      Map<String, BigDecimal> momentumByCategoryId) {

    List<RebalanceSuggestionDto> suggestions = new ArrayList<>();

    // Categories with an optimal target — compare current vs optimal
    for (Map.Entry<String, BigDecimal> entry : optimalAllocationByCategoryId.entrySet()) {
      String categoryId = entry.getKey();
      BigDecimal optimalPct = entry.getValue();
      BigDecimal currentPct =
          currentAllocationByCategoryId.getOrDefault(categoryId, BigDecimal.ZERO);
      BigDecimal delta = optimalPct.subtract(currentPct).setScale(2, RoundingMode.HALF_UP);
      String action = delta.compareTo(BigDecimal.ZERO) >= 0 ? "INCREASE" : "DECREASE";

      // In the optimal set → selected top-N momentum sector, so the signal is BUY.
      BigDecimal momentum = momentumByCategoryId.get(categoryId);
      String tradeSignal = MomentumTradeSignalDeriver.derive(momentum, true);
      suggestions.add(
          buildSuggestion(
              categoriesById, categoryId, action, currentPct, optimalPct, delta, tradeSignal,
              momentum));
    }

    // Categories held but not in the optimal set (untracked cash/BIL, or a sector that fell out of
    // the top-N) — suggest reducing toward zero.
    for (Map.Entry<String, BigDecimal> entry : currentAllocationByCategoryId.entrySet()) {
      String categoryId = entry.getKey();
      if (optimalAllocationByCategoryId.containsKey(categoryId)) continue;
      BigDecimal currentPct = entry.getValue();
      if (currentPct.compareTo(BigDecimal.ZERO) <= 0) continue;
      BigDecimal delta = BigDecimal.ZERO.subtract(currentPct).setScale(2, RoundingMode.HALF_UP);

      BigDecimal momentum = momentumByCategoryId.get(categoryId);
      String tradeSignal = MomentumTradeSignalDeriver.derive(momentum, false);
      suggestions.add(
          buildSuggestion(
              categoriesById, categoryId, "DECREASE", currentPct, BigDecimal.ZERO, delta,
              tradeSignal, momentum));
    }

    return suggestions.stream()
        .filter(s -> s.deltaPct().abs().compareTo(new BigDecimal("0.5")) > 0)
        .sorted(Comparator.comparing(s -> s.deltaPct().abs(), Comparator.reverseOrder()))
        .toList();
  }

  private RebalanceSuggestionDto buildSuggestion(
      Map<String, Category> categoriesById,
      String categoryId,
      String action,
      BigDecimal currentPct,
      BigDecimal optimalPct,
      BigDecimal delta,
      String tradeSignal,
      BigDecimal momentum) {

    String categoryName =
        categoriesById.containsKey(categoryId)
            ? categoriesById.get(categoryId).name()
            : categoryId;

    // Aligned when the trade matches the signal: adding a BUY, or trimming a REDUCE.
    boolean signalAligned =
        ("INCREASE".equals(action) && "BUY".equals(tradeSignal))
            || ("DECREASE".equals(action) && "REDUCE".equals(tradeSignal));

    return new RebalanceSuggestionDto(
        categoryId,
        categoryName,
        action,
        currentPct,
        optimalPct,
        delta,
        tradeSignal,
        null,
        toPercent(momentum),
        signalAligned);
  }

  /** Rounds a momentum return (e.g. 0.1454) to a whole-percent Integer (15); null passes through. */
  private Integer toPercent(BigDecimal momentum) {
    return momentum == null ? null : momentum.multiply(HUNDRED).setScale(0, RoundingMode.HALF_UP).intValue();
  }
}
