package com.ftm.app.portfolio.service;

import com.ftm.app.api.dto.PortfolioEntryDto;
import com.ftm.app.api.dto.PortfolioResponse;
import com.ftm.app.api.dto.PortfolioResponse.PortfolioAllocationEntry;
import com.ftm.app.api.dto.RebalanceSuggestionDto;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryId;
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

  private final PortfolioRepository portfolioRepository;
  private final CategoryRepository categoryRepository;
  private final SignalRepository signalRepository;
  private final AlignmentService alignmentService;

  public PortfolioService(
      PortfolioRepository portfolioRepository,
      CategoryRepository categoryRepository,
      SignalRepository signalRepository,
      AlignmentService alignmentService) {
    this.portfolioRepository = portfolioRepository;
    this.categoryRepository = categoryRepository;
    this.signalRepository = signalRepository;
    this.alignmentService = alignmentService;
  }

  public PortfolioResponse getPortfolio() {
    Map<String, Category> categoriesById =
        categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc().stream()
            .filter(c -> c.parentId() == null)
            .collect(Collectors.toMap(c -> c.id().name(), c -> c));

    Map<String, BigDecimal> currentAllocationByCategoryId =
        portfolioRepository.findAll().stream()
            .collect(Collectors.toMap(p -> p.categoryId().name(), Portfolio::allocationPct));

    Map<String, BigDecimal> compositeScoreByCategoryId =
        signalRepository.findLatestByType(SignalType.COMPOSITE);

    Map<String, BigDecimal> optimalAllocationByCategoryId =
        alignmentService.computeCompositeOptimalAllocation(compositeScoreByCategoryId);

    BigDecimal alignmentScore =
        alignmentService.computeAlignmentScore(
            currentAllocationByCategoryId, compositeScoreByCategoryId);

    String alignmentLabel = resolveAlignmentLabel(alignmentScore);

    List<PortfolioAllocationEntry> allocationEntries =
        categoriesById.values().stream()
            .map(
                category -> {
                  String categoryId = category.id().name();
                  return new PortfolioAllocationEntry(
                      categoryId,
                      category.name(),
                      category.type().name(),
                      currentAllocationByCategoryId.getOrDefault(categoryId, BigDecimal.ZERO),
                      compositeScoreByCategoryId.get(categoryId),
                      optimalAllocationByCategoryId.get(categoryId));
                })
            .sorted(Comparator.comparing(PortfolioAllocationEntry::categoryId))
            .toList();

    List<RebalanceSuggestionDto> rebalanceSuggestions =
        buildRebalanceSuggestions(
            categoriesById, currentAllocationByCategoryId, optimalAllocationByCategoryId);

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
      Map<String, BigDecimal> optimalAllocationByCategoryId) {

    List<RebalanceSuggestionDto> suggestions = new ArrayList<>();

    // Categories with an optimal target — compare current vs optimal
    for (Map.Entry<String, BigDecimal> entry : optimalAllocationByCategoryId.entrySet()) {
      String categoryId = entry.getKey();
      BigDecimal optimalPct = entry.getValue();
      BigDecimal currentPct =
          currentAllocationByCategoryId.getOrDefault(categoryId, BigDecimal.ZERO);
      BigDecimal delta = optimalPct.subtract(currentPct).setScale(2, RoundingMode.HALF_UP);
      String action = delta.compareTo(BigDecimal.ZERO) >= 0 ? "INCREASE" : "DECREASE";
      String categoryName =
          categoriesById.containsKey(categoryId)
              ? categoriesById.get(categoryId).name()
              : categoryId;
      suggestions.add(
          new RebalanceSuggestionDto(
              categoryId, categoryName, action, currentPct, optimalPct, delta));
    }

    // Categories with current allocation but NO optimal target (e.g. CASH/BIL, untracked)
    // These should be reduced to 0% — signals say to deploy into signal-tracked categories
    for (Map.Entry<String, BigDecimal> entry : currentAllocationByCategoryId.entrySet()) {
      String categoryId = entry.getKey();
      if (optimalAllocationByCategoryId.containsKey(categoryId)) continue;
      BigDecimal currentPct = entry.getValue();
      if (currentPct.compareTo(BigDecimal.ZERO) <= 0) continue;
      BigDecimal delta = BigDecimal.ZERO.subtract(currentPct).setScale(2, RoundingMode.HALF_UP);
      String categoryName =
          categoriesById.containsKey(categoryId)
              ? categoriesById.get(categoryId).name()
              : categoryId;
      suggestions.add(
          new RebalanceSuggestionDto(
              categoryId, categoryName, "DECREASE", currentPct, BigDecimal.ZERO, delta));
    }

    return suggestions.stream()
        .filter(s -> s.deltaPct().abs().compareTo(new BigDecimal("0.5")) > 0)
        .sorted(Comparator.comparing(s -> s.deltaPct().abs(), Comparator.reverseOrder()))
        .toList();
  }
}
