package com.ftm.app.themes.assembler;

import com.ftm.app.api.dto.ThemeConstituentDto;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.service.TradeSignalDeriver;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Builds the per-ETF rows of a theme: each constituent's latest signals, its derived trade signal,
 * and its conviction score.
 */
@Component
public class ThemeConstituentAssembler {

  /** The latest value of one signal type, per category. */
  private static Map<String, BigDecimal> valuesOf(
      Map<SignalType, Map<String, BigDecimal>> signals, SignalType type) {
    return signals.getOrDefault(type, Collections.emptyMap());
  }

  public List<ThemeConstituentDto> assemble(
      List<String> categoryIds,
      Map<String, Category> categoriesById,
      Map<SignalType, Map<String, BigDecimal>> signals) {

    Map<String, BigDecimal> composites = valuesOf(signals, SignalType.COMPOSITE);
    Map<String, BigDecimal> rs60s = valuesOf(signals, SignalType.RS_60);
    Map<String, BigDecimal> rs120s = valuesOf(signals, SignalType.RS_120);
    Map<String, BigDecimal> flows = valuesOf(signals, SignalType.FLOW_20D);
    Map<String, BigDecimal> trend5ds = valuesOf(signals, SignalType.COMPOSITE_TREND_5D);
    Map<String, BigDecimal> trend20ds = valuesOf(signals, SignalType.COMPOSITE_TREND_20D);
    Map<String, BigDecimal> rrgQuadrants = valuesOf(signals, SignalType.RRG_QUADRANT);
    Map<String, BigDecimal> macroFits = valuesOf(signals, SignalType.MACRO_FIT);

    return categoryIds.stream()
        .map(
            categoryId -> {
              Category category = categoriesById.get(categoryId);
              BigDecimal composite = composites.get(categoryId);
              BigDecimal rs60 = rs60s.get(categoryId);
              BigDecimal flow20d = flows.get(categoryId);
              BigDecimal trend20d = trend20ds.get(categoryId);
              String rrgQuadrant = quadrantOf(rrgQuadrants.get(categoryId));

              int conviction =
                  TradeSignalDeriver.convictionScore(
                      composite,
                      rrgQuadrant,
                      trend20d,
                      macroFits.get(categoryId),
                      null,
                      trend5ds.get(categoryId),
                      rs60,
                      rs120s.get(categoryId),
                      flow20d,
                      null);

              return new ThemeConstituentDto(
                  categoryId,
                  parentIdOf(category, categoryId),
                  category != null ? category.name() : categoryId,
                  category != null ? category.etfTicker() : "",
                  composite,
                  rs60,
                  flow20d,
                  trend5ds.get(categoryId),
                  trend20d,
                  TradeSignalDeriver.derive(composite, rrgQuadrant, trend20d),
                  conviction > 0 ? conviction : null);
            })
        .toList();
  }

  /** A category with no parent is its own parent — a top-level sector stands alone. */
  private static String parentIdOf(Category category, String categoryId) {
    return category != null && category.parentId() != null ? category.parentId() : categoryId;
  }

  private static String quadrantOf(BigDecimal rawQuadrant) {
    return rawQuadrant != null ? String.valueOf(rawQuadrant.intValue()) : null;
  }
}
