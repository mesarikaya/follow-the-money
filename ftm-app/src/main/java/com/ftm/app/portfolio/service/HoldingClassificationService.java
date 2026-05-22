package com.ftm.app.portfolio.service;

import com.ftm.app.portfolio.repository.TickerMappingRepository;
import jakarta.annotation.PostConstruct;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Classifies investment tickers to FTM category IDs by looking up the ticker_category_map table.
 * The in-memory map is loaded at startup and refreshed after any CRUD on that table.
 */
@Service
public class HoldingClassificationService {

  private final TickerMappingRepository tickerMappingRepository;
  private volatile Map<String, String> tickerToCategory;

  public HoldingClassificationService(TickerMappingRepository tickerMappingRepository) {
    this.tickerMappingRepository = tickerMappingRepository;
  }

  @PostConstruct
  void loadCache() {
    refreshCache();
  }

  public void refreshCache() {
    tickerToCategory = tickerMappingRepository.findAllAsMap();
  }

  public Optional<String> classify(String ticker) {
    return Optional.ofNullable(tickerToCategory.get(ticker.toUpperCase()));
  }

  public String classifyOrUnknown(String ticker) {
    return tickerToCategory.get(ticker.toUpperCase());
  }
}
