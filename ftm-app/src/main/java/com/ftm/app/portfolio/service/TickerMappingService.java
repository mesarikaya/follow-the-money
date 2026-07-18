package com.ftm.app.portfolio.service;

import com.ftm.app.category.repository.CategoryRepository;
import com.ftm.app.portfolio.domain.TickerMapping;
import com.ftm.app.portfolio.repository.TickerMappingRepository;
import java.util.NoSuchElementException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Orchestrates ticker→category mapping changes: validate, persist, refresh the classification
 * cache, and backfill any holdings the new mapping now covers.
 *
 * <p>Validation matters because a holding's category_id is a foreign key to {@code categories}:
 * mapping a ticker to a non-existent category would let the write "succeed" and then crash the
 * follow-up reclassification with an opaque 500. Rejecting the unknown category up front turns
 * that into a clear {@link IllegalArgumentException} (surfaced as a 422 by the global handler).
 */
@Service
public class TickerMappingService {

  private static final Logger log = LoggerFactory.getLogger(TickerMappingService.class);

  private final TickerMappingRepository tickerMappingRepository;
  private final CategoryRepository categoryRepository;
  private final HoldingClassificationService classificationService;
  private final HoldingUploadService holdingUploadService;

  public TickerMappingService(
      TickerMappingRepository tickerMappingRepository,
      CategoryRepository categoryRepository,
      HoldingClassificationService classificationService,
      HoldingUploadService holdingUploadService) {
    this.tickerMappingRepository = tickerMappingRepository;
    this.categoryRepository = categoryRepository;
    this.classificationService = classificationService;
    this.holdingUploadService = holdingUploadService;
  }

  public TickerMapping upsert(String ticker, String categoryId, String notes) {
    if (!categoryRepository.existsById(categoryId)) {
      throw new IllegalArgumentException(
          "Unknown category '"
              + categoryId
              + "'. Ticker mappings must reference an existing category id.");
    }
    tickerMappingRepository.upsert(ticker, categoryId, notes);
    classificationService.refreshCache();
    int reclassified = holdingUploadService.resyncHoldingCategories();
    if (reclassified > 0) {
      log.info("ticker mapping upsert for {}: reclassified {} holding(s)", ticker, reclassified);
    }
    return tickerMappingRepository
        .findByTicker(ticker)
        .orElseThrow(() -> new NoSuchElementException("Ticker mapping not found after upsert: " + ticker));
  }

  public boolean delete(String ticker) {
    int deleted = tickerMappingRepository.delete(ticker);
    if (deleted == 0) return false;
    classificationService.refreshCache();
    return true;
  }
}
