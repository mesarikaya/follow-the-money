package com.ftm.app.api.mapper;

import com.ftm.app.api.dto.CategorySummaryDto;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.api.service.TradeSignalDeriver;
import java.math.BigDecimal;
import java.util.Map;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(
    componentModel = "spring",
    imports = {TradeSignalDeriver.class})
public interface CategoryMapper {

  @Mapping(target = "id", source = "row.category.id")
  @Mapping(target = "name", source = "row.category.name")
  @Mapping(target = "type", expression = "java(row.category().type().name())")
  @Mapping(target = "etfTicker", source = "row.category.etfTicker")
  @Mapping(
      target = "compositeScore",
      expression = "java(compositeByCategoryId.get(row.category().id().name()))")
  @Mapping(
      target = "compositeTrend5d",
      expression = "java(compositeTrend5dByCategoryId.get(row.category().id().name()))")
  @Mapping(
      target = "compositeTrend10d",
      expression = "java(compositeTrend10dByCategoryId.get(row.category().id().name()))")
  @Mapping(
      target = "compositeTrend20d",
      expression = "java(compositeTrend20dByCategoryId.get(row.category().id().name()))")
  @Mapping(
      target = "rrgQuadrant",
      expression =
          "java(rrgQuadrantByCategoryId.containsKey(row.category().id().name()) ? String.valueOf(rrgQuadrantByCategoryId.get(row.category().id().name()).intValue()) : null)")
  @Mapping(target = "rs60", expression = "java(rs60ByCategoryId.get(row.category().id().name()))")
  @Mapping(target = "rs120", expression = "java(rs120ByCategoryId.get(row.category().id().name()))")
  @Mapping(target = "rs20", expression = "java(rs20ByCategoryId.get(row.category().id().name()))")
  @Mapping(
      target = "flow20d",
      expression = "java(flow20dByCategoryId.get(row.category().id().name()))")
  @Mapping(
      target = "persistence5d",
      expression =
          "java(persistence5dByCategoryId.containsKey(row.category().id().name()) ? persistence5dByCategoryId.get(row.category().id().name()).intValue() : null)")
  @Mapping(
      target = "persistence20d",
      expression =
          "java(persistence20dByCategoryId.containsKey(row.category().id().name()) ? persistence20dByCategoryId.get(row.category().id().name()).intValue() : null)")
  @Mapping(target = "rank", source = "rank")
  @Mapping(target = "latestClose", source = "row.latestClose")
  @Mapping(target = "priceDate", source = "row.priceDate")
  @Mapping(
      target = "tradeSignal",
      expression =
          "java(TradeSignalDeriver.derive("
              + "compositeByCategoryId.get(row.category().id().name()), "
              + "rrgQuadrantByCategoryId.containsKey(row.category().id().name()) ? String.valueOf(rrgQuadrantByCategoryId.get(row.category().id().name()).intValue()) : null, "
              + "compositeTrend20dByCategoryId.get(row.category().id().name())))")
  @Mapping(
      target = "macroFit",
      expression = "java(macroFitByCategoryId.get(row.category().id().name()))")
  @Mapping(
      target = "momentum",
      expression = "java(momentumByCategoryId.get(row.category().id().name()))")
  @Mapping(
      target = "signalDaysActive",
      expression = "java(signalDaysActiveByCategoryId.get(row.category().id().name()))")
  @Mapping(
      target = "realizedVol20d",
      expression = "java(realizedVol20dByCategoryId.get(row.category().id().name()))")
  @Mapping(
      target = "scorePercentile252d",
      expression = "java(scorePercentile252dByCategoryId.get(row.category().id().name()))")
  @Mapping(
      target = "convictionScore",
      expression =
          "java(TradeSignalDeriver.convictionScore("
              + "compositeByCategoryId.get(row.category().id().name()), "
              + "rrgQuadrantByCategoryId.containsKey(row.category().id().name()) ? String.valueOf(rrgQuadrantByCategoryId.get(row.category().id().name()).intValue()) : null, "
              + "compositeTrend20dByCategoryId.get(row.category().id().name()), "
              + "macroFitByCategoryId.get(row.category().id().name()), "
              + "scorePercentile252dByCategoryId.get(row.category().id().name()), "
              + "compositeTrend5dByCategoryId.get(row.category().id().name()), "
              + "rs60ByCategoryId.get(row.category().id().name()), "
              + "rs120ByCategoryId.get(row.category().id().name()), "
              + "flow20dByCategoryId.get(row.category().id().name()), "
              + "rs20ByCategoryId.get(row.category().id().name())))")
  CategorySummaryDto toDto(
      CategoryRepository.CategoryPriceRow row,
      int rank,
      Map<String, BigDecimal> rs60ByCategoryId,
      Map<String, BigDecimal> compositeByCategoryId,
      Map<String, BigDecimal> rrgQuadrantByCategoryId,
      Map<String, BigDecimal> compositeTrend5dByCategoryId,
      Map<String, BigDecimal> compositeTrend10dByCategoryId,
      Map<String, BigDecimal> compositeTrend20dByCategoryId,
      Map<String, BigDecimal> rs120ByCategoryId,
      Map<String, BigDecimal> rs20ByCategoryId,
      Map<String, BigDecimal> flow20dByCategoryId,
      Map<String, BigDecimal> persistence5dByCategoryId,
      Map<String, BigDecimal> persistence20dByCategoryId,
      Map<String, BigDecimal> macroFitByCategoryId,
      Map<String, BigDecimal> momentumByCategoryId,
      Map<String, Integer> signalDaysActiveByCategoryId,
      Map<String, BigDecimal> realizedVol20dByCategoryId,
      Map<String, BigDecimal> scorePercentile252dByCategoryId);
}
