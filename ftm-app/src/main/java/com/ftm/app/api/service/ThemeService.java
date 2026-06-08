package com.ftm.app.api.service;

import com.ftm.app.api.dto.ThemeConstituentDto;
import com.ftm.app.api.dto.ThemeDetailDto;
import com.ftm.app.api.dto.ThemeHistoryPointDto;
import com.ftm.app.api.dto.ThemeSummaryDto;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.SignalType;
import com.ftm.app.domain.Theme;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.themes.repository.ThemeRepository;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.OptionalDouble;
import java.util.stream.Collectors;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class ThemeService {

  private final ThemeRepository themeRepository;
  private final CategoryRepository categoryRepository;
  private final SignalRepository signalRepository;

  public ThemeService(
      ThemeRepository themeRepository,
      CategoryRepository categoryRepository,
      SignalRepository signalRepository) {
    this.themeRepository = themeRepository;
    this.categoryRepository = categoryRepository;
    this.signalRepository = signalRepository;
  }

  @Cacheable("themes-latest")
  public List<ThemeSummaryDto> getThemes() {
    List<Theme> themes = themeRepository.findAll();
    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    Map<String, Category> categoriesById = buildCategoryIndex();
    Map<SignalType, Map<String, BigDecimal>> signals = fetchSignals();

    Map<String, BigDecimal> compositeMap =
        signals.getOrDefault(SignalType.COMPOSITE, Collections.emptyMap());

    return themes.stream()
        .map(
            theme -> {
              List<String> ids = constituentsByTheme.getOrDefault(theme.id(), List.of());
              List<ThemeConstituentDto> allConstituents =
                  buildConstituents(ids, categoriesById, signals);
              List<ThemeConstituentDto> top3 =
                  allConstituents.stream()
                      .filter(c -> c.compositeScore() != null)
                      .sorted(
                          Comparator.comparing(
                              ThemeConstituentDto::compositeScore, Comparator.reverseOrder()))
                      .limit(3)
                      .toList();
              return toSummary(theme, allConstituents, top3, categoriesById, compositeMap);
            })
        .toList();
  }

  @Cacheable(value = "theme-history", key = "#themeId + '-' + #tradingDays")
  public List<ThemeHistoryPointDto> getThemeHistory(String themeId, int tradingDays) {
    assertThemeExists(themeId);
    List<String> constituentIds = themeRepository.findConstituentIds(themeId);
    return signalRepository.findAverageCompositeByDate(constituentIds, tradingDays).stream()
        .map(point -> new ThemeHistoryPointDto(point.date().toString(), point.averageComposite()))
        .toList();
  }

  @Cacheable(value = "theme-detail", key = "#themeId")
  public ThemeDetailDto getTheme(String themeId) {
    List<Theme> themes = themeRepository.findAll();
    Theme theme =
        themes.stream()
            .filter(t -> t.id().equals(themeId))
            .findFirst()
            .orElseThrow(() -> new NoSuchElementException("Theme not found: " + themeId));

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    List<String> ids = constituentsByTheme.getOrDefault(themeId, List.of());
    Map<String, Category> categoriesById = buildCategoryIndex();
    Map<SignalType, Map<String, BigDecimal>> signals = fetchSignals();

    List<ThemeConstituentDto> constituents = buildConstituents(ids, categoriesById, signals);
    List<ThemeConstituentDto> sorted =
        constituents.stream()
            .sorted(
                Comparator.comparing(
                    c -> c.compositeScore() != null ? c.compositeScore() : BigDecimal.ZERO,
                    Comparator.<BigDecimal>reverseOrder()))
            .toList();

    Map<String, BigDecimal> compositeMap =
        signals.getOrDefault(SignalType.COMPOSITE, Collections.emptyMap());
    ThemeSummaryDto summary =
        toSummary(
            theme, constituents, sorted.stream().limit(3).toList(), categoriesById, compositeMap);
    return new ThemeDetailDto(
        summary.id(),
        summary.name(),
        summary.thesis(),
        summary.constituentCount(),
        summary.compositeScore(),
        summary.rs60(),
        summary.flow20d(),
        summary.compositeTrend20d(),
        summary.bullishCount(),
        summary.dominantSignal(),
        summary.divergenceFromParentSectors(),
        sorted);
  }

  private void assertThemeExists(String themeId) {
    if (!themeRepository.existsById(themeId)) {
      throw new NoSuchElementException("Theme not found: " + themeId);
    }
  }

  private Map<String, Category> buildCategoryIndex() {
    return categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc().stream()
        .collect(Collectors.toMap(c -> c.id().name(), c -> c));
  }

  private Map<SignalType, Map<String, BigDecimal>> fetchSignals() {
    return signalRepository.findLatestByTypes(
        List.of(
            SignalType.COMPOSITE,
            SignalType.RS_60,
            SignalType.FLOW_20D,
            SignalType.COMPOSITE_TREND_20D,
            SignalType.RRG_QUADRANT,
            SignalType.MACRO_FIT,
            SignalType.RS_120,
            SignalType.COMPOSITE_TREND_5D));
  }

  private List<ThemeConstituentDto> buildConstituents(
      List<String> categoryIds,
      Map<String, Category> categoriesById,
      Map<SignalType, Map<String, BigDecimal>> signals) {

    Map<String, BigDecimal> compositeMap =
        signals.getOrDefault(SignalType.COMPOSITE, Collections.emptyMap());
    Map<String, BigDecimal> rs60Map =
        signals.getOrDefault(SignalType.RS_60, Collections.emptyMap());
    Map<String, BigDecimal> flow20dMap =
        signals.getOrDefault(SignalType.FLOW_20D, Collections.emptyMap());
    Map<String, BigDecimal> trend20dMap =
        signals.getOrDefault(SignalType.COMPOSITE_TREND_20D, Collections.emptyMap());
    Map<String, BigDecimal> rrgMap =
        signals.getOrDefault(SignalType.RRG_QUADRANT, Collections.emptyMap());
    Map<String, BigDecimal> macroFitMap =
        signals.getOrDefault(SignalType.MACRO_FIT, Collections.emptyMap());
    Map<String, BigDecimal> rs120Map =
        signals.getOrDefault(SignalType.RS_120, Collections.emptyMap());
    Map<String, BigDecimal> trend5dMap =
        signals.getOrDefault(SignalType.COMPOSITE_TREND_5D, Collections.emptyMap());

    return categoryIds.stream()
        .map(
            id -> {
              Category cat = categoriesById.get(id);
              String name = cat != null ? cat.name() : id;
              String ticker = cat != null ? cat.etfTicker() : "";
              BigDecimal composite = compositeMap.get(id);
              BigDecimal rs60 = rs60Map.get(id);
              BigDecimal flow20d = flow20dMap.get(id);
              BigDecimal trend20d = trend20dMap.get(id);
              BigDecimal rrgRaw = rrgMap.get(id);
              String rrg = rrgRaw != null ? String.valueOf(rrgRaw.intValue()) : null;
              int conviction =
                  TradeSignalDeriver.convictionScore(
                      composite,
                      rrg,
                      trend20d,
                      macroFitMap.get(id),
                      null,
                      trend5dMap.get(id),
                      rs60,
                      rs120Map.get(id),
                      flow20d,
                      null);
              return new ThemeConstituentDto(
                  id,
                  name,
                  ticker,
                  composite,
                  rs60,
                  flow20d,
                  trend20d,
                  TradeSignalDeriver.derive(composite, rrg, trend20d),
                  conviction > 0 ? conviction : null);
            })
        .toList();
  }

  private ThemeSummaryDto toSummary(
      Theme theme,
      List<ThemeConstituentDto> allConstituents,
      List<ThemeConstituentDto> topConstituents,
      Map<String, Category> categoriesById,
      Map<String, BigDecimal> compositeByCategory) {

    OptionalDouble avgComposite =
        allConstituents.stream()
            .filter(c -> c.compositeScore() != null)
            .mapToDouble(c -> c.compositeScore().doubleValue())
            .average();
    OptionalDouble avgRs60 =
        allConstituents.stream()
            .filter(c -> c.rs60() != null)
            .mapToDouble(c -> c.rs60().doubleValue())
            .average();
    OptionalDouble avgFlow =
        allConstituents.stream()
            .filter(c -> c.flow20d() != null)
            .mapToDouble(c -> c.flow20d().doubleValue())
            .average();
    OptionalDouble avgTrend =
        allConstituents.stream()
            .filter(c -> c.compositeTrend20d() != null)
            .mapToDouble(c -> c.compositeTrend20d().doubleValue())
            .average();

    long buyCount = allConstituents.stream().filter(c -> "BUY".equals(c.tradeSignal())).count();
    long watchCount = allConstituents.stream().filter(c -> "WATCH".equals(c.tradeSignal())).count();
    long reduceCount =
        allConstituents.stream().filter(c -> "REDUCE".equals(c.tradeSignal())).count();
    int bullishCount = (int) (buyCount + watchCount);
    int total = allConstituents.size();

    String dominantSignal;
    if (total > 0 && buyCount * 2 >= total) dominantSignal = "BUY";
    else if (total > 0 && (buyCount + watchCount) * 2 >= total) dominantSignal = "WATCH";
    else if (total > 0 && reduceCount * 2 > total) dominantSignal = "REDUCE";
    else dominantSignal = "HOLD";

    // Divergence: theme composite − average composite of constituent parent sectors.
    // Positive = theme sub-sectors outpacing their sectors → early rotation signal.
    Double divergence = null;
    if (avgComposite.isPresent()) {
      OptionalDouble parentAvg =
          allConstituents.stream()
              .map(
                  c -> {
                    Category cat = categoriesById.get(c.categoryId());
                    if (cat == null) return null;
                    String parentId = cat.parentId();
                    if (parentId == null) parentId = c.categoryId();
                    BigDecimal parentScore = compositeByCategory.get(parentId);
                    return parentScore != null ? parentScore.doubleValue() : null;
                  })
              .filter(Objects::nonNull)
              .mapToDouble(Double::doubleValue)
              .average();
      if (parentAvg.isPresent()) {
        divergence = avgComposite.getAsDouble() - parentAvg.getAsDouble();
      }
    }

    return new ThemeSummaryDto(
        theme.id(),
        theme.name(),
        theme.thesis(),
        total,
        avgComposite.isPresent() ? avgComposite.getAsDouble() : null,
        avgRs60.isPresent() ? avgRs60.getAsDouble() : null,
        avgFlow.isPresent() ? avgFlow.getAsDouble() : null,
        avgTrend.isPresent() ? avgTrend.getAsDouble() : null,
        bullishCount,
        dominantSignal,
        divergence,
        topConstituents);
  }
}
