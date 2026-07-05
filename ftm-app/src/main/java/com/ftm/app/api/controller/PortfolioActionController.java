package com.ftm.app.api.controller;

import com.ftm.app.api.dto.CategorySummaryDto;
import com.ftm.app.api.dto.HoldingActionDto;
import com.ftm.app.api.dto.HoldingDto;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.api.service.CategoryService;
import com.ftm.app.api.service.PortfolioActionEngine;
import com.ftm.app.domain.Category;
import com.ftm.app.portfolio.service.HoldingUploadService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/portfolio/actions")
@Tag(
    name = "Portfolio Actions",
    description =
        "Signal-driven action recommendations for each current holding — EXIT, TRIM, WATCH, or HOLD")
public class PortfolioActionController {

  private final HoldingUploadService holdingUploadService;
  private final CategoryService categoryService;
  private final CategoryRepository categoryRepository;
  private final PortfolioActionEngine portfolioActionEngine;

  public PortfolioActionController(
      HoldingUploadService holdingUploadService,
      CategoryService categoryService,
      CategoryRepository categoryRepository,
      PortfolioActionEngine portfolioActionEngine) {
    this.holdingUploadService = holdingUploadService;
    this.categoryService = categoryService;
    this.categoryRepository = categoryRepository;
    this.portfolioActionEngine = portfolioActionEngine;
  }

  @Operation(
      summary = "Recommended actions for all current holdings",
      description =
          "Fetches current holdings and cross-references them against the latest signal data to "
              + "produce a prioritised action list (EXIT → TRIM → WATCH → HOLD → UNCLASSIFIED).")
  @GetMapping
  public ResponseEntity<List<HoldingActionDto>> getActions(
      @RequestParam(defaultValue = "60d") String timeframe) {

    List<HoldingDto> holdings = holdingUploadService.getHoldings();
    if (holdings.isEmpty()) {
      return ResponseEntity.ok(List.of());
    }

    Map<String, CategorySummaryDto> categoriesById =
        categoryService.getCategoriesResponse(timeframe).categories().stream()
            .filter(c -> c.id() != null)
            .collect(Collectors.toMap(c -> c.id().name(), c -> c, (a, b) -> a));

    // Holdings carry sub-category ids (INDU_ADEF, SEMI, ...); this map lets the engine roll them up
    // to their parent sector, which is what the top-level category map contains.
    Map<String, String> parentByCategoryId = new HashMap<>();
    for (Category category : categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc()) {
      parentByCategoryId.put(category.id().name(), category.parentId());
    }

    BigDecimal totalPortfolioEur =
        holdings.stream()
            .map(HoldingDto::marketValueEur)
            .filter(Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

    List<HoldingActionDto> actions =
        portfolioActionEngine.deriveActions(
            holdings, categoriesById, parentByCategoryId, totalPortfolioEur);

    return ResponseEntity.ok(actions);
  }
}
