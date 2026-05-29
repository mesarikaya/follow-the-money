package com.ftm.app.api.mapper;

import com.ftm.app.api.dto.CategorySummaryDto;
import com.ftm.app.api.repository.CategoryRepository;
import java.math.BigDecimal;
import java.util.Map;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
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
  @Mapping(
      target = "flow20d",
      expression = "java(flow20dByCategoryId.get(row.category().id().name()))")
  @Mapping(
      target = "persistence20d",
      expression =
          "java(persistence20dByCategoryId.containsKey(row.category().id().name()) ? persistence20dByCategoryId.get(row.category().id().name()).intValue() : null)")
  @Mapping(target = "rank", source = "rank")
  @Mapping(target = "latestClose", source = "row.latestClose")
  @Mapping(target = "priceDate", source = "row.priceDate")
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
      Map<String, BigDecimal> flow20dByCategoryId,
      Map<String, BigDecimal> persistence20dByCategoryId);
}
