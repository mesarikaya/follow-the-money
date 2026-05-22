package com.ftm.app.api.controller;

import com.ftm.app.api.dto.PortfolioEntryDto;
import com.ftm.app.api.dto.PortfolioResponse;
import com.ftm.app.portfolio.service.PortfolioService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/portfolio")
public class PortfolioController {

  private final PortfolioService portfolioService;

  public PortfolioController(PortfolioService portfolioService) {
    this.portfolioService = portfolioService;
  }

  @GetMapping
  public PortfolioResponse getPortfolio() {
    return portfolioService.getPortfolio();
  }

  @PutMapping
  public ResponseEntity<PortfolioResponse> savePortfolio(
      @Valid @RequestBody List<@Valid PortfolioEntryDto> entries) {
    portfolioService.savePortfolio(entries);
    return ResponseEntity.ok(portfolioService.getPortfolio());
  }
}
