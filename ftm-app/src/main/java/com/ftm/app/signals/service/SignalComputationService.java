package com.ftm.app.signals.service;

import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.signals.domain.MacroRegime;
import com.ftm.app.signals.event.SignalsUpdatedEvent;
import com.ftm.app.signals.repository.PriceHistoryRepository;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.signals.repository.SignalRepository.Row;
import com.ftm.app.signals.service.DailySignalComputer.MarketContext;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Brings the signal table up to date: work out which trading days are missing, compute every signal
 * for each of them, write them in chunks, derive the composite trends, and tell the rest of the app
 * that new signals have landed.
 */
@Service
public class SignalComputationService {

  private static final Logger log = LoggerFactory.getLogger(SignalComputationService.class);

  private static final int UPSERT_CHUNK_SIZE = 5_000;

  private final CategoryRepository categoryRepository;
  private final SignalRepository signalRepository;
  private final PriceHistoryRepository priceHistoryRepository;
  private final MacroRegimeService macroRegimeService;
  private final DailySignalComputer dailySignalComputer;
  private final CompositeTrendComputer compositeTrendComputer;
  private final ApplicationEventPublisher events;

  public SignalComputationService(
      CategoryRepository categoryRepository,
      SignalRepository signalRepository,
      PriceHistoryRepository priceHistoryRepository,
      MacroRegimeService macroRegimeService,
      DailySignalComputer dailySignalComputer,
      CompositeTrendComputer compositeTrendComputer,
      ApplicationEventPublisher events) {
    this.categoryRepository = categoryRepository;
    this.signalRepository = signalRepository;
    this.priceHistoryRepository = priceHistoryRepository;
    this.macroRegimeService = macroRegimeService;
    this.dailySignalComputer = dailySignalComputer;
    this.compositeTrendComputer = compositeTrendComputer;
    this.events = events;
  }

  @Transactional
  public void computeAndStore() {
    List<LocalDate> allTradeDates = signalRepository.findAllTradeDatesAscending();
    if (allTradeDates.isEmpty()) {
      log.warn("No price data found; skipping signal computation");
      return;
    }

    List<Category> categories = categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc();
    Optional<LocalDate> latestSignalDate = signalRepository.findLatestSignalDate();
    List<LocalDate> datesToProcess =
        datesToProcess(allTradeDates, latestSignalDate, categories);
    if (datesToProcess.isEmpty()) {
      log.info("Signals are up to date through {} — nothing to compute", latestSignalDate.get());
      return;
    }

    LocalDate latestDate = datesToProcess.get(datesToProcess.size() - 1);
    log.info(
        "Computing signals for {} dates ({} → {}), latest existing signal={}",
        datesToProcess.size(),
        datesToProcess.get(0),
        latestDate,
        latestSignalDate.orElse(null));

    MacroRegime currentRegime = macroRegimeService.classifyCurrentRegime();
    warnIfBackfillingAcrossRegimes(datesToProcess, currentRegime);

    MarketContext context = loadMarketContext(categories, currentRegime);
    int totalWritten = computeAndWrite(datesToProcess, context);

    log.info(
        "Signal computation complete: {} signals written for {} dates, regime={}",
        totalWritten,
        datesToProcess.size(),
        currentRegime);

    log.info("Composite trend signals stored: {}", compositeTrendComputer.computeAndStore());

    events.publishEvent(new SignalsUpdatedEvent(latestDate));
  }

  /**
   * The trading days still missing signals. Normally that is everything after the last signal date —
   * but a category added later has no history at all, which forces a full backfill.
   */
  private List<LocalDate> datesToProcess(
      List<LocalDate> allTradeDates,
      Optional<LocalDate> latestSignalDate,
      List<Category> categories) {
    List<LocalDate> newDates =
        latestSignalDate
            .map(lastDate -> allTradeDates.stream().filter(date -> date.isAfter(lastDate)).toList())
            .orElse(allTradeDates);
    if (!newDates.isEmpty()) return newDates;

    if (!hasCategoryWithoutSignals(categories)) return List.of();
    log.info(
        "New categories detected without signals — running full historical backfill for all {} trade dates",
        allTradeDates.size());
    return allTradeDates;
  }

  private boolean hasCategoryWithoutSignals(List<Category> categories) {
    Set<String> categoryIdsWithSignals = signalRepository.findAllCategoryIdsWithSignals();
    return categories.stream()
        .anyMatch(category -> !categoryIdsWithSignals.contains(category.id().name()));
  }

  private void warnIfBackfillingAcrossRegimes(
      List<LocalDate> datesToProcess, MacroRegime currentRegime) {
    if (datesToProcess.size() <= 1) return;
    log.warn(
        "Historical backfill uses the CURRENT macro regime ({}) for all {} dates. "
            + "Backtesting results covering different market regimes may be biased.",
        currentRegime,
        datesToProcess.size());
  }

  private MarketContext loadMarketContext(List<Category> categories, MacroRegime currentRegime) {
    return new MarketContext(
        categories,
        priceHistoryRepository.findCategoryPricesByCategoryId(),
        priceHistoryRepository.findBenchmarkPricesByTicker(),
        macroRegimeService.computeMacroFitByCategory(currentRegime),
        BigDecimal.valueOf(currentRegime.ordinal()));
  }

  /** Writes in chunks so a long backfill does not hold every row in memory at once. */
  private int computeAndWrite(List<LocalDate> datesToProcess, MarketContext context) {
    List<Row> pendingRows = new ArrayList<>();
    int totalWritten = 0;

    for (LocalDate signalDate : datesToProcess) {
      pendingRows.addAll(dailySignalComputer.compute(signalDate, context));
      if (pendingRows.size() >= UPSERT_CHUNK_SIZE) {
        totalWritten += signalRepository.batchUpsert(pendingRows);
        pendingRows.clear();
      }
    }
    if (!pendingRows.isEmpty()) {
      totalWritten += signalRepository.batchUpsert(pendingRows);
    }
    return totalWritten;
  }
}
