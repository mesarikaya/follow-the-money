package com.ftm.app.api.service;

import com.ftm.app.api.dto.SubSectorSummaryDto;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
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

    Map<String, BigDecimal> rs20ByCategory = signalRepository.findLatestByType(SignalType.RS_20);
    Map<String, BigDecimal> rs60ByCategory = signalRepository.findLatestByType(SignalType.RS_60);
    Map<String, BigDecimal> rs120ByCategory = signalRepository.findLatestByType(SignalType.RS_120);
    Map<String, BigDecimal> momentumByCategory = signalRepository.findLatestByType(SignalType.MOM);
    Map<String, BigDecimal> rrgQuadrantByCategory =
        signalRepository.findLatestByType(SignalType.RRG_QUADRANT);
    Map<String, BigDecimal> compositeByCategory =
        signalRepository.findLatestByType(SignalType.COMPOSITE);
    Map<String, BigDecimal> trend5dByCategory =
        signalRepository.findLatestByType(SignalType.COMPOSITE_TREND_5D);
    Map<String, BigDecimal> trend20dByCategory =
        signalRepository.findLatestByType(SignalType.COMPOSITE_TREND_20D);

    return subCategories.stream()
        .map(
            category -> {
              String categoryId = category.id().name();
              BigDecimal rrgQuadrantValue = rrgQuadrantByCategory.get(categoryId);
              String rrgQuadrant =
                  rrgQuadrantValue != null ? String.valueOf(rrgQuadrantValue.intValue()) : null;
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
                  compositeByCategory.get(categoryId),
                  trend5dByCategory.get(categoryId),
                  trend20dByCategory.get(categoryId));
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
