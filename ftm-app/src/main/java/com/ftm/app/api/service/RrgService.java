package com.ftm.app.api.service;

import com.ftm.app.api.dto.RrgCategoryEntry;
import com.ftm.app.api.dto.RrgResponse;
import com.ftm.app.api.dto.RrgTrailPoint;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalAnalyticsRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class RrgService {

  private static final int TRAIL_DAYS = 42;

  private static final List<String> PALETTE =
      List.of(
          "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16",
          "#F97316", "#6366F1", "#14B8A6", "#F43F5E", "#22D3EE", "#A855F7", "#FCD34D", "#34D399",
          "#FB7185", "#60A5FA", "#A3E635", "#FBBF24");

  private final SignalAnalyticsRepository signalAnalyticsRepository;
  private final CategoryRepository categoryRepository;

  public RrgService(SignalAnalyticsRepository signalAnalyticsRepository, CategoryRepository categoryRepository) {
    this.signalAnalyticsRepository = signalAnalyticsRepository;
    this.categoryRepository = categoryRepository;
  }

  @Cacheable("rrg-latest")
  public RrgResponse getLatest() {
    List<SignalAnalyticsRepository.RrgRow> rows = signalAnalyticsRepository.findRrgTrail(TRAIL_DAYS);
    if (rows.isEmpty()) return new RrgResponse(LocalDate.now(), List.of());

    Map<String, Category> categoryById =
        categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc().stream()
            .collect(Collectors.toMap(c -> c.id().name(), c -> c));

    LocalDate latestDate =
        rows.stream()
            .map(SignalAnalyticsRepository.RrgRow::signalDate)
            .max(LocalDate::compareTo)
            .orElse(LocalDate.now());

    List<RrgCategoryEntry> entries =
        rows.stream()
            .collect(Collectors.groupingBy(SignalAnalyticsRepository.RrgRow::categoryId))
            .entrySet()
            .stream()
            .filter(e -> categoryById.containsKey(e.getKey()))
            .map(e -> buildEntry(e.getKey(), e.getValue(), categoryById.get(e.getKey())))
            .sorted(Comparator.comparingInt(entry -> categoryById.get(entry.id()).displayOrder()))
            .toList();

    return new RrgResponse(latestDate, entries);
  }

  private RrgCategoryEntry buildEntry(
      String catId, List<SignalAnalyticsRepository.RrgRow> rows, Category cat) {
    Map<LocalDate, BigDecimal> ratioByDate =
        rows.stream()
            .filter(r -> r.signalType() == SignalType.RRG_RATIO)
            .collect(
                Collectors.toMap(
                    SignalAnalyticsRepository.RrgRow::signalDate, SignalAnalyticsRepository.RrgRow::value));

    Map<LocalDate, BigDecimal> momByDate =
        rows.stream()
            .filter(r -> r.signalType() == SignalType.RRG_MOM)
            .collect(
                Collectors.toMap(
                    SignalAnalyticsRepository.RrgRow::signalDate, SignalAnalyticsRepository.RrgRow::value));

    int latestQuadrant =
        rows.stream()
            .filter(r -> r.signalType() == SignalType.RRG_QUADRANT)
            .max(Comparator.comparing(SignalAnalyticsRepository.RrgRow::signalDate))
            .map(r -> r.value().intValue())
            .orElse(0);

    List<RrgTrailPoint> trail =
        ratioByDate.keySet().stream()
            .filter(momByDate::containsKey)
            .sorted()
            .map(date -> new RrgTrailPoint(date, ratioByDate.get(date), momByDate.get(date)))
            .toList();

    String color = PALETTE.get(cat.displayOrder() % PALETTE.size());
    return new RrgCategoryEntry(catId, cat.name(), color, latestQuadrant, trail);
  }
}
