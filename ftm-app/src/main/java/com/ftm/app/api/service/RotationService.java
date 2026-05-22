package com.ftm.app.api.service;

import com.ftm.app.api.dto.RotationEventEntry;
import com.ftm.app.api.dto.RotationLeaderEntry;
import com.ftm.app.api.dto.RotationResponse;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.RotationEvent;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.RotationEventRepository;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class RotationService {

  private static final Logger log = LoggerFactory.getLogger(RotationService.class);

  private static final int ROTATION_LEADER_COUNT = 3;
  private static final int RECENT_EVENTS_LOOKBACK_DAYS = 90;

  private final CategoryRepository categoryRepository;
  private final SignalRepository signalRepository;
  private final RotationEventRepository rotationEventRepository;

  public RotationService(
      CategoryRepository categoryRepository,
      SignalRepository signalRepository,
      RotationEventRepository rotationEventRepository) {
    this.categoryRepository = categoryRepository;
    this.signalRepository = signalRepository;
    this.rotationEventRepository = rotationEventRepository;
  }

  @Cacheable("rotation-latest")
  public RotationResponse getLatest() {
    log.debug("Loading rotation data");

    Map<String, Category> categoriesById =
        categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc().stream()
            .collect(Collectors.toMap(c -> c.id().name(), c -> c));

    Map<String, BigDecimal> compositeScores =
        signalRepository.findLatestByType(SignalType.COMPOSITE);
    Map<String, BigDecimal> relativeStrength60Days =
        signalRepository.findLatestByType(SignalType.RS_60);
    Map<String, BigDecimal> rrgQuadrants =
        signalRepository.findLatestByType(SignalType.RRG_QUADRANT);

    LocalDate asOfDate =
        signalRepository.findLatestSignalDate().orElse(LocalDate.now());

    List<RotationLeaderEntry> allRanked =
        categoriesById.entrySet().stream()
            .filter(entry -> compositeScores.containsKey(entry.getKey()))
            .map(
                entry -> {
                  String categoryId = entry.getKey();
                  Category category = entry.getValue();
                  BigDecimal composite = compositeScores.get(categoryId);
                  BigDecimal rs60 = relativeStrength60Days.get(categoryId);
                  BigDecimal quadrant = rrgQuadrants.get(categoryId);
                  return new RotationLeaderEntry(
                      categoryId,
                      category.name(),
                      composite,
                      rs60,
                      quadrant != null ? quadrant.intValue() : null);
                })
            .sorted(
                Comparator.comparing(
                    RotationLeaderEntry::compositeScore,
                    Comparator.nullsLast(Comparator.reverseOrder())))
            .toList();

    List<RotationLeaderEntry> topLeaders = allRanked.stream().limit(ROTATION_LEADER_COUNT).toList();

    List<RotationLeaderEntry> bottomLaggards =
        allRanked.reversed().stream().limit(ROTATION_LEADER_COUNT).toList();

    List<RotationEvent> recentEvents =
        rotationEventRepository.findRecentEvents(
            LocalDate.now().minusDays(RECENT_EVENTS_LOOKBACK_DAYS));

    List<RotationEventEntry> eventEntries =
        recentEvents.stream()
            .map(
                event -> {
                  Category category = categoriesById.get(event.categoryId().name());
                  String categoryName =
                      category != null ? category.name() : event.categoryId().name();
                  return new RotationEventEntry(
                      event.detectedDate(),
                      event.categoryId().name(),
                      categoryName,
                      event.eventType().name(),
                      event.confidence(),
                      event.notes());
                })
            .toList();

    return new RotationResponse(asOfDate, topLeaders, bottomLaggards, eventEntries);
  }
}
