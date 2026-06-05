package com.ftm.app.api.controller;

import com.ftm.app.api.dto.PortfolioEntryDto;
import com.ftm.app.api.dto.PortfolioResponse;
import com.ftm.app.portfolio.service.PortfolioService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/portfolio")
@Tag(name = "Portfolio", description = "Target-allocation portfolio entries")
public class PortfolioController {

  private final PortfolioService portfolioService;

  public PortfolioController(PortfolioService portfolioService) {
    this.portfolioService = portfolioService;
  }

  @GetMapping
  @Operation(summary = "Current portfolio with per-holding metrics and gap analysis")
  public PortfolioResponse getPortfolio() {
    return portfolioService.getPortfolio();
  }

  @PutMapping
  @Operation(summary = "Replace the entire portfolio with the submitted entries")
  public ResponseEntity<PortfolioResponse> savePortfolio(
      @Valid @RequestBody List<@Valid PortfolioEntryDto> entries) {
    portfolioService.savePortfolio(entries);
    return ResponseEntity.ok(portfolioService.getPortfolio());
  }
}
