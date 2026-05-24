package com.ftm.app.signals.service;

import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.RotationEvent;
import com.ftm.app.domain.RotationEventType;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.event.SignalsUpdatedEvent;
import com.ftm.app.signals.repository.RotationEventRepository;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Detects meaningful rotation events after each signal computation run.
 *
 * <p>Detected event types (per D-008 / EP-008 acceptance criteria): - ENTERING_IMPROVING: RRG
 * quadrant transitions Lagging(1) → Improving(3) - ENTERING_LEADING: RRG quadrant transitions
 * Improving(3) → Leading(4) - COMPOSITE_BREAKOUT: Composite score crosses above 0.70 threshold -
 * FLOW_SURGE: Deferred — requires FLOW signal computation (EP-005 T-001-3)
 */
@Service
public class RotationEventDetector {

  private static final Logger log = LoggerFactory.getLogger(RotationEventDetector.class);

  private static final BigDecimal COMPOSITE_BREAKOUT_THRESHOLD = new BigDecimal("0.70");

  private static final int LAGGING_QUADRANT = 1;
  private static final int WEAKENING_QUADRANT = 2;
  private static final int IMPROVING_QUADRANT = 3;
  private static final int LEADING_QUADRANT = 4;

  private final SignalRepository signalRepository;
  private final RotationEventRepository rotationEventRepository;
  private final CategoryRepository categoryRepository;

  public RotationEventDetector(
      SignalRepository signalRepository,
      RotationEventRepository rotationEventRepository,
      CategoryRepository categoryRepository) {
    this.signalRepository = signalRepository;
    this.rotationEventRepository = rotationEventRepository;
    this.categoryRepository = categoryRepository;
  }

  @EventListener
  @Async
  public void onSignalsUpdated(SignalsUpdatedEvent event) {
    LocalDate currentSignalDate = event.signalDate();
    log.info("Detecting rotation events for signal_date={}", currentSignalDate);

    Set<String> topLevelCategoryIds =
        categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc().stream()
            .filter(c -> c.parentId() == null)
            .map(c -> c.id().name())
            .collect(Collectors.toSet());

    Map<String, BigDecimal> currentQuadrants =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, currentSignalDate);
    Map<String, BigDecimal> currentComposites =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, currentSignalDate);

    LocalDate previousSignalDate =
        signalRepository.findPreviousSignalDate(SignalType.RRG_QUADRANT, currentSignalDate);
    Map<String, BigDecimal> previousQuadrants =
        previousSignalDate != null
            ? signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, previousSignalDate)
            : Map.of();

    LocalDate previousCompositeDate =
        signalRepository.findPreviousSignalDate(SignalType.COMPOSITE, currentSignalDate);
    Map<String, BigDecimal> previousComposites =
        previousCompositeDate != null
            ? signalRepository.findByTypeAndDate(SignalType.COMPOSITE, previousCompositeDate)
            : Map.of();

    int eventsDetected = 0;

    for (String categoryId : currentQuadrants.keySet()) {
      if (!topLevelCategoryIds.contains(categoryId)) continue;
      BigDecimal currentQuadrant = currentQuadrants.get(categoryId);
      BigDecimal previousQuadrant = previousQuadrants.get(categoryId);
      BigDecimal currentComposite = currentComposites.get(categoryId);
      BigDecimal previousComposite = previousComposites.get(categoryId);

      eventsDetected +=
          detectQuadrantTransitions(
              categoryId, currentSignalDate, currentQuadrant, previousQuadrant);
      eventsDetected +=
          detectCompositeBreakout(
              categoryId, currentSignalDate, currentComposite, previousComposite);
    }

    log.info(
        "Rotation event detection complete: {} events detected for date={}",
        eventsDetected,
        currentSignalDate);
  }

  private int detectQuadrantTransitions(
      String categoryId,
      LocalDate detectedDate,
      BigDecimal currentQuadrant,
      BigDecimal previousQuadrant) {
    if (currentQuadrant == null || previousQuadrant == null) return 0;

    int current = currentQuadrant.intValue();
    int previous = previousQuadrant.intValue();

    if (previous == LAGGING_QUADRANT && current == IMPROVING_QUADRANT) {
      return recordIfNew(
          detectedDate,
          categoryId,
          RotationEventType.ENTERING_IMPROVING,
          new BigDecimal("0.800"),
          String.format("{\"previousQuadrant\":%d,\"currentQuadrant\":%d}", previous, current),
          "Quadrant transition from Lagging to Improving");
    }

    if (previous == IMPROVING_QUADRANT && current == LEADING_QUADRANT) {
      return recordIfNew(
          detectedDate,
          categoryId,
          RotationEventType.ENTERING_LEADING,
          new BigDecimal("0.900"),
          String.format("{\"previousQuadrant\":%d,\"currentQuadrant\":%d}", previous, current),
          "Quadrant transition from Improving to Leading");
    }

    if (previous == LEADING_QUADRANT && current == WEAKENING_QUADRANT) {
      return recordIfNew(
          detectedDate,
          categoryId,
          RotationEventType.ENTERING_WEAKENING,
          new BigDecimal("0.750"),
          String.format("{\"previousQuadrant\":%d,\"currentQuadrant\":%d}", previous, current),
          "Quadrant transition from Leading to Weakening — rotation peak signal");
    }

    if (previous == WEAKENING_QUADRANT && current == LAGGING_QUADRANT) {
      return recordIfNew(
          detectedDate,
          categoryId,
          RotationEventType.ENTERING_LAGGING,
          new BigDecimal("0.800"),
          String.format("{\"previousQuadrant\":%d,\"currentQuadrant\":%d}", previous, current),
          "Quadrant transition from Weakening to Lagging — sector losing relative strength");
    }

    return 0;
  }

  private int detectCompositeBreakout(
      String categoryId,
      LocalDate detectedDate,
      BigDecimal currentComposite,
      BigDecimal previousComposite) {
    if (currentComposite == null) return 0;
    if (previousComposite != null
        && previousComposite.compareTo(COMPOSITE_BREAKOUT_THRESHOLD) >= 0) {
      return 0; // Already above threshold — not a new breakout
    }
    if (currentComposite.compareTo(COMPOSITE_BREAKOUT_THRESHOLD) <= 0) return 0;

    return recordIfNew(
        detectedDate,
        categoryId,
        RotationEventType.COMPOSITE_BREAKOUT,
        currentComposite.min(BigDecimal.ONE),
        String.format(
            "{\"compositeScore\":%.6f,\"threshold\":%.2f}",
            currentComposite, COMPOSITE_BREAKOUT_THRESHOLD),
        "Composite score crossed 0.70 breakout threshold");
  }

  private int recordIfNew(
      LocalDate detectedDate,
      String categoryId,
      RotationEventType eventType,
      BigDecimal confidence,
      String signalSnapshot,
      String notes) {
    if (rotationEventRepository.existsForDateAndType(detectedDate, categoryId, eventType)) {
      return 0;
    }
    rotationEventRepository.insert(
        new RotationEvent(
            detectedDate,
            com.ftm.app.domain.CategoryId.valueOf(categoryId),
            eventType,
            confidence,
            signalSnapshot,
            notes));
    log.debug(
        "Rotation event recorded: {} for category={} on date={}",
        eventType,
        categoryId,
        detectedDate);
    return 1;
  }
}
