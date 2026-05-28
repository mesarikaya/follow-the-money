package com.ftm.app.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.instancio.Select.field;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

import com.ftm.app.api.dto.SubSectorSummaryDto;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.CategoryType;
import com.ftm.app.domain.SignalType;
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
  @InjectMocks SubSectorService subSectorService;

  private Category subCategory(CategoryId id, String parentId) {
    return Instancio.of(Category.class)
        .set(field(Category::id), id)
        .set(field(Category::type), CategoryType.EQUITY_SECTOR)
        .set(field(Category::active), true)
        .set(field(Category::parentId), parentId)
        .create();
  }

  private Map<SignalType, Map<String, BigDecimal>> emptySignals() {
    return Map.ofEntries(
        Map.entry(SignalType.RS_20, Map.of()),
        Map.entry(SignalType.RS_60, Map.of()),
        Map.entry(SignalType.RS_120, Map.of()),
        Map.entry(SignalType.MOM, Map.of()),
        Map.entry(SignalType.RRG_QUADRANT, Map.of()),
        Map.entry(SignalType.COMPOSITE, Map.of()),
        Map.entry(SignalType.COMPOSITE_TREND_5D, Map.of()),
        Map.entry(SignalType.COMPOSITE_TREND_20D, Map.of()));
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
                Map.entry(SignalType.COMPOSITE_TREND_20D, Map.of())));

    List<SubSectorSummaryDto> result = subSectorService.getSubSectors("TECH");

    assertThat(result).hasSize(1);
    assertThat(result.get(0).id()).isEqualTo("SEMI");
    assertThat(result.get(0).parentId()).isEqualTo("TECH");
    assertThat(result.get(0).rs20()).isEqualByComparingTo("1.05");
    assertThat(result.get(0).rs60()).isEqualByComparingTo("1.12");
    assertThat(result.get(0).rs120()).isNull();
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
                Map.entry(SignalType.COMPOSITE_TREND_20D, Map.of())));

    List<SubSectorSummaryDto> result = subSectorService.getSubSectors("TECH");

    assertThat(result).hasSize(2);
    assertThat(result.get(0).id()).isEqualTo("CLOD");
    assertThat(result.get(1).id()).isEqualTo("SEMI");
  }
}
