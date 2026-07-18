package com.ftm.app.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.instancio.Select.field;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

import com.ftm.app.api.dto.SubSectorSummaryDto;
import com.ftm.app.category.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.CategoryType;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalAnalyticsRepository;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.instancio.Instancio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SubSectorServiceTest {

  @Mock CategoryRepository categoryRepository;
  @Mock SignalRepository signalRepository;
  @Mock SignalAnalyticsRepository signalAnalyticsRepository;
  @InjectMocks SubSectorService subSectorService;

  private Category subCategory(CategoryId id, String parentId) {
    return Instancio.of(Category.class)
        .set(field(Category::id), id)
        .set(field(Category::type), CategoryType.EQUITY_SECTOR)
        .set(field(Category::active), true)
        .set(field(Category::parentId), parentId)
        .create();
  }

  private Map<SignalType, Map<String, BigDecimal>> noSignals() {
    return Map.ofEntries(
        Map.entry(SignalType.RS_20, Map.of()),
        Map.entry(SignalType.RS_60, Map.of()),
        Map.entry(SignalType.RS_120, Map.of()),
        Map.entry(SignalType.MOM, Map.of()),
        Map.entry(SignalType.RRG_QUADRANT, Map.of()),
        Map.entry(SignalType.COMPOSITE, Map.of()),
        Map.entry(SignalType.COMPOSITE_TREND_5D, Map.of()),
        Map.entry(SignalType.COMPOSITE_TREND_20D, Map.of()),
        Map.entry(SignalType.PERSISTENCE_5D, Map.of()),
        Map.entry(SignalType.PERSISTENCE_20D, Map.of()),
        Map.entry(SignalType.MACRO_FIT, Map.of()),
        Map.entry(SignalType.FLOW_20D, Map.of()));
  }

  @Test
  @DisplayName("getSubSectors returns empty list when parent has no sub-categories")
  void shouldReturnEmptyWhenNoSubCategories() {
    when(categoryRepository.findSubCategoriesByParentId("TECH")).thenReturn(List.of());

    List<SubSectorSummaryDto> result = subSectorService.getSubSectors("TECH");

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("getSubSectors maps category fields and signal values")
  void shouldMapCategoryAndSignals() {
    Category semi = subCategory(CategoryId.SEMI, "TECH");
    when(categoryRepository.findSubCategoriesByParentId("TECH")).thenReturn(List.of(semi));
    when(signalRepository.findLatestByTypes(anyList()))
        .thenReturn(
            Map.ofEntries(
                Map.entry(SignalType.RS_20, Map.of("SEMI", new BigDecimal("1.05"))),
                Map.entry(SignalType.RS_60, Map.of("SEMI", new BigDecimal("1.12"))),
                Map.entry(SignalType.RS_120, Map.of()),
                Map.entry(SignalType.MOM, Map.of()),
                Map.entry(SignalType.RRG_QUADRANT, Map.of()),
                Map.entry(SignalType.COMPOSITE, Map.of()),
                Map.entry(SignalType.COMPOSITE_TREND_5D, Map.of()),
                Map.entry(SignalType.COMPOSITE_TREND_20D, Map.of()),
                Map.entry(SignalType.PERSISTENCE_5D, Map.of()),
                Map.entry(SignalType.PERSISTENCE_20D, Map.of()),
                Map.entry(SignalType.MACRO_FIT, Map.of()),
                Map.entry(SignalType.FLOW_20D, Map.of())));

    List<SubSectorSummaryDto> result = subSectorService.getSubSectors("TECH");

    assertThat(result).hasSize(1);
    assertThat(result.get(0).id()).isEqualTo("SEMI");
    assertThat(result.get(0).parentId()).isEqualTo("TECH");
    assertThat(result.get(0).rs20()).isEqualByComparingTo("1.05");
    assertThat(result.get(0).rs60()).isEqualByComparingTo("1.12");
    assertThat(result.get(0).rs120()).isNull();
  }

  @Test
  @DisplayName("getSubSectors computes tradeSignal from composite, rrg, and trend20d")
  void shouldComputeTradeSignal() {
    Category semi = subCategory(CategoryId.SEMI, "TECH");
    when(categoryRepository.findSubCategoriesByParentId("TECH")).thenReturn(List.of(semi));
    when(signalRepository.findLatestByTypes(anyList()))
        .thenReturn(
            Map.ofEntries(
                Map.entry(SignalType.RS_20, Map.of()),
                Map.entry(SignalType.RS_60, Map.of()),
                Map.entry(SignalType.RS_120, Map.of()),
                Map.entry(SignalType.MOM, Map.of()),
                Map.entry(SignalType.RRG_QUADRANT, Map.of("SEMI", new BigDecimal("4"))),
                Map.entry(SignalType.COMPOSITE, Map.of("SEMI", new BigDecimal("0.72"))),
                Map.entry(SignalType.COMPOSITE_TREND_5D, Map.of()),
                Map.entry(SignalType.COMPOSITE_TREND_20D, Map.of("SEMI", new BigDecimal("0.02"))),
                Map.entry(SignalType.PERSISTENCE_5D, Map.of()),
                Map.entry(SignalType.PERSISTENCE_20D, Map.of()),
                Map.entry(SignalType.MACRO_FIT, Map.of()),
                Map.entry(SignalType.FLOW_20D, Map.of())));

    List<SubSectorSummaryDto> result = subSectorService.getSubSectors("TECH");

    assertThat(result).hasSize(1);
    assertThat(result.get(0).tradeSignal()).isEqualTo("BUY");
  }

  @Test
  @DisplayName("getSubSectors sorts by rs60 descending")
  void shouldSortByRs60Descending() {
    Category semi = subCategory(CategoryId.SEMI, "TECH");
    Category clod = subCategory(CategoryId.CLOD, "TECH");
    when(categoryRepository.findSubCategoriesByParentId("TECH")).thenReturn(List.of(semi, clod));
    when(signalRepository.findLatestByTypes(anyList()))
        .thenReturn(
            Map.ofEntries(
                Map.entry(SignalType.RS_20, Map.of()),
                Map.entry(
                    SignalType.RS_60,
                    Map.of("SEMI", new BigDecimal("1.05"), "CLOD", new BigDecimal("1.20"))),
                Map.entry(SignalType.RS_120, Map.of()),
                Map.entry(SignalType.MOM, Map.of()),
                Map.entry(SignalType.RRG_QUADRANT, Map.of()),
                Map.entry(SignalType.COMPOSITE, Map.of()),
                Map.entry(SignalType.COMPOSITE_TREND_5D, Map.of()),
                Map.entry(SignalType.COMPOSITE_TREND_20D, Map.of()),
                Map.entry(SignalType.PERSISTENCE_5D, Map.of()),
                Map.entry(SignalType.PERSISTENCE_20D, Map.of()),
                Map.entry(SignalType.MACRO_FIT, Map.of()),
                Map.entry(SignalType.FLOW_20D, Map.of())));

    List<SubSectorSummaryDto> result = subSectorService.getSubSectors("TECH");

    assertThat(result).hasSize(2);
    assertThat(result.get(0).id()).isEqualTo("CLOD");
    assertThat(result.get(1).id()).isEqualTo("SEMI");
  }

  @Test
  @DisplayName(
      "getSubSectors maps persistence5d, persistence20d (int) and macroFit (decimal) from signals")
  void shouldMapPersistenceAndMacroFit() {
    Category semi = subCategory(CategoryId.SEMI, "TECH");
    when(categoryRepository.findSubCategoriesByParentId("TECH")).thenReturn(List.of(semi));
    when(signalRepository.findLatestByTypes(anyList()))
        .thenReturn(
            Map.ofEntries(
                Map.entry(SignalType.RS_20, Map.of()),
                Map.entry(SignalType.RS_60, Map.of()),
                Map.entry(SignalType.RS_120, Map.of()),
                Map.entry(SignalType.MOM, Map.of()),
                Map.entry(SignalType.RRG_QUADRANT, Map.of()),
                Map.entry(SignalType.COMPOSITE, Map.of()),
                Map.entry(SignalType.COMPOSITE_TREND_5D, Map.of()),
                Map.entry(SignalType.COMPOSITE_TREND_20D, Map.of()),
                Map.entry(SignalType.PERSISTENCE_5D, Map.of("SEMI", new BigDecimal("4"))),
                Map.entry(SignalType.PERSISTENCE_20D, Map.of("SEMI", new BigDecimal("14"))),
                Map.entry(SignalType.MACRO_FIT, Map.of("SEMI", new BigDecimal("0.72"))),
                Map.entry(SignalType.FLOW_20D, Map.of())));

    List<SubSectorSummaryDto> result = subSectorService.getSubSectors("TECH");

    assertThat(result).hasSize(1);
    assertThat(result.get(0).persistence5d()).isEqualTo(4);
    assertThat(result.get(0).persistence20d()).isEqualTo(14);
    assertThat(result.get(0).macroFit()).isEqualByComparingTo("0.72");
  }

  @Test
  @DisplayName(
      "getSubSectors returns null persistence5d, persistence20d and macroFit when signals absent")
  void shouldReturnNullPersistenceAndMacroFitWhenSignalsAbsent() {
    Category semi = subCategory(CategoryId.SEMI, "TECH");
    when(categoryRepository.findSubCategoriesByParentId("TECH")).thenReturn(List.of(semi));
    when(signalRepository.findLatestByTypes(anyList())).thenReturn(noSignals());

    List<SubSectorSummaryDto> result = subSectorService.getSubSectors("TECH");

    assertThat(result).hasSize(1);
    assertThat(result.get(0).persistence5d()).isNull();
    assertThat(result.get(0).persistence20d()).isNull();
    assertThat(result.get(0).macroFit()).isNull();
  }

  @Test
  @DisplayName("getSubSectors computes convictionScore ≥75 when all key signals are strong BUY")
  void shouldComputeConvictionScoreForSubSector() {
    Category semi = subCategory(CategoryId.SEMI, "TECH");
    when(categoryRepository.findSubCategoriesByParentId("TECH")).thenReturn(List.of(semi));
    when(signalRepository.findLatestByTypes(anyList()))
        .thenReturn(
            Map.ofEntries(
                Map.entry(SignalType.RS_20, Map.of()),
                Map.entry(SignalType.RS_60, Map.of("SEMI", new BigDecimal("1.15"))),
                Map.entry(SignalType.RS_120, Map.of("SEMI", new BigDecimal("1.08"))),
                Map.entry(SignalType.MOM, Map.of()),
                Map.entry(SignalType.RRG_QUADRANT, Map.of("SEMI", new BigDecimal("4"))),
                Map.entry(SignalType.COMPOSITE, Map.of("SEMI", new BigDecimal("0.82"))),
                Map.entry(SignalType.COMPOSITE_TREND_5D, Map.of("SEMI", new BigDecimal("0.03"))),
                Map.entry(SignalType.COMPOSITE_TREND_20D, Map.of("SEMI", new BigDecimal("0.05"))),
                Map.entry(SignalType.PERSISTENCE_5D, Map.of()),
                Map.entry(SignalType.PERSISTENCE_20D, Map.of()),
                Map.entry(SignalType.MACRO_FIT, Map.of("SEMI", new BigDecimal("0.80"))),
                Map.entry(SignalType.FLOW_20D, Map.of())));
    when(signalAnalyticsRepository.findScorePercentile252d())
        .thenReturn(Map.of("SEMI", new BigDecimal("0.90")));
    when(signalAnalyticsRepository.findSignalDaysActive(any(BigDecimal.class))).thenReturn(Map.of());

    List<SubSectorSummaryDto> result = subSectorService.getSubSectors("TECH");

    assertThat(result).hasSize(1);
    assertThat(result.get(0).convictionScore()).isNotNull().isGreaterThanOrEqualTo(75);
  }

  @Test
  @DisplayName("getSubSectors maps signalDaysActive from repository response")
  void shouldMapSignalDaysActiveFromRepository() {
    Category semi = subCategory(CategoryId.SEMI, "TECH");
    when(categoryRepository.findSubCategoriesByParentId("TECH")).thenReturn(List.of(semi));
    when(signalRepository.findLatestByTypes(anyList())).thenReturn(noSignals());
    when(signalAnalyticsRepository.findSignalDaysActive(any(BigDecimal.class)))
        .thenReturn(Map.of("SEMI", 12));
    when(signalAnalyticsRepository.findScorePercentile252d()).thenReturn(Map.of());

    List<SubSectorSummaryDto> result = subSectorService.getSubSectors("TECH");

    assertThat(result).hasSize(1);
    assertThat(result.get(0).signalDaysActive()).isEqualTo(12);
  }
}
