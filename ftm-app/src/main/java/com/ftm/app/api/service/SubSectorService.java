package com.ftm.app.api.service;

import com.ftm.app.api.dto.SubSectorSummaryDto;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class SubSectorService {

  private final CategoryRepository categoryRepository;
  private final SignalRepository signalRepository;

  public SubSectorService(
      CategoryRepository categoryRepository, SignalRepository signalRepository) {
    this.categoryRepository = categoryRepository;
    this.signalRepository = signalRepository;
  }

  @Cacheable(value = "sub-sectors-latest", key = "#parentCategoryId")
  public List<SubSectorSummaryDto> getSubSectors(String parentCategoryId) {
    List<Category> subCategories = categoryRepository.findSubCategoriesByParentId(parentCategoryId);
    if (subCategories.isEmpty()) return List.of();

    Map<SignalType, Map<String, BigDecimal>> signals =
        signalRepository.findLatestByTypes(
            List.of(
                SignalType.RS_20,
                SignalType.RS_60,
                SignalType.RS_120,
                SignalType.MOM,
                SignalType.RRG_QUADRANT,
                SignalType.COMPOSITE,
                SignalType.COMPOSITE_TREND_5D,
                SignalType.COMPOSITE_TREND_20D,
                SignalType.PERSISTENCE_5D,
                SignalType.PERSISTENCE_20D,
                SignalType.MACRO_FIT));

    Map<String, BigDecimal> rs20ByCategory =
        signals.getOrDefault(SignalType.RS_20, Collections.emptyMap());
    Map<String, BigDecimal> rs60ByCategory =
        signals.getOrDefault(SignalType.RS_60, Collections.emptyMap());
    Map<String, BigDecimal> rs120ByCategory =
        signals.getOrDefault(SignalType.RS_120, Collections.emptyMap());
    Map<String, BigDecimal> momentumByCategory =
        signals.getOrDefault(SignalType.MOM, Collections.emptyMap());
    Map<String, BigDecimal> rrgQuadrantByCategory =
        signals.getOrDefault(SignalType.RRG_QUADRANT, Collections.emptyMap());
    Map<String, BigDecimal> compositeByCategory =
        signals.getOrDefault(SignalType.COMPOSITE, Collections.emptyMap());
    Map<String, BigDecimal> trend5dByCategory =
        signals.getOrDefault(SignalType.COMPOSITE_TREND_5D, Collections.emptyMap());
    Map<String, BigDecimal> trend20dByCategory =
        signals.getOrDefault(SignalType.COMPOSITE_TREND_20D, Collections.emptyMap());
    Map<String, BigDecimal> persistence5dByCategory =
        signals.getOrDefault(SignalType.PERSISTENCE_5D, Collections.emptyMap());
    Map<String, BigDecimal> persistence20dByCategory =
        signals.getOrDefault(SignalType.PERSISTENCE_20D, Collections.emptyMap());
    Map<String, BigDecimal> macroFitByCategory =
        signals.getOrDefault(SignalType.MACRO_FIT, Collections.emptyMap());

    return subCategories.stream()
        .map(
            category -> {
              String categoryId = category.id().name();
              BigDecimal rrgQuadrantValue = rrgQuadrantByCategory.get(categoryId);
              String rrgQuadrant =
                  rrgQuadrantValue != null ? String.valueOf(rrgQuadrantValue.intValue()) : null;
              BigDecimal compositeScore = compositeByCategory.get(categoryId);
              BigDecimal trend20d = trend20dByCategory.get(categoryId);
              BigDecimal persistence5dRaw = persistence5dByCategory.get(categoryId);
              Integer persistence5d = persistence5dRaw != null ? persistence5dRaw.intValue() : null;
              BigDecimal persistence20dRaw = persistence20dByCategory.get(categoryId);
              Integer persistence20d =
                  persistence20dRaw != null ? persistence20dRaw.intValue() : null;
              return new SubSectorSummaryDto(
                  categoryId,
                  category.name(),
                  category.parentId(),
                  category.etfTicker(),
                  rs20ByCategory.get(categoryId),
                  rs60ByCategory.get(categoryId),
                  rs120ByCategory.get(categoryId),
                  momentumByCategory.get(categoryId),
                  rrgQuadrant,
                  compositeScore,
                  trend5dByCategory.get(categoryId),
                  trend20d,
                  TradeSignalDeriver.derive(compositeScore, rrgQuadrant, trend20d),
                  persistence5d,
                  persistence20d,
                  macroFitByCategory.get(categoryId));
            })
        .sorted(
            (subSectorA, subSectorB) -> {
              BigDecimal rs60A = subSectorA.rs60() != null ? subSectorA.rs60() : BigDecimal.ZERO;
              BigDecimal rs60B = subSectorB.rs60() != null ? subSectorB.rs60() : BigDecimal.ZERO;
              return rs60B.compareTo(rs60A);
            })
        .toList();
  }
}
