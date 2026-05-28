package com.ftm.app.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.instancio.Select.field;
import static org.mockito.Mockito.when;

import com.ftm.app.api.dto.RrgCategoryEntry;
import com.ftm.app.api.dto.RrgResponse;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.CategoryType;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.instancio.Instancio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RrgServiceTest {

  @Mock SignalRepository signalRepository;
  @Mock CategoryRepository categoryRepository;
  @InjectMocks RrgService rrgService;

  private static final LocalDate DATE1 = LocalDate.of(2024, 5, 30);
  private static final LocalDate DATE2 = LocalDate.of(2024, 5, 31);
  private static final LocalDate DATE3 = LocalDate.of(2024, 6, 1);

  private Category category(CategoryId id, String name, int displayOrder) {
    return Instancio.of(Category.class)
        .set(field(Category::id), id)
        .set(field(Category::name), name)
        .set(field(Category::type), CategoryType.EQUITY_SECTOR)
        .set(field(Category::displayOrder), displayOrder)
        .set(field(Category::active), true)
        .set(field(Category::parentId), null)
        .create();
  }

  private SignalRepository.RrgRow row(LocalDate date, String categoryId, SignalType type, String value) {
    return new SignalRepository.RrgRow(date, categoryId, type, new BigDecimal(value));
  }

  @Test
  @DisplayName("getLatest returns empty response when no RRG trail data exists")
  void shouldReturnEmptyResponseWhenNoData() {
    when(signalRepository.findRrgTrail(42)).thenReturn(List.of());

    RrgResponse response = rrgService.getLatest();

    assertThat(response.categories()).isEmpty();
    assertThat(response.date()).isEqualTo(LocalDate.now());
  }

  @Test
  @DisplayName("getLatest builds trail from RRG_RATIO and RRG_MOM signals")
  void shouldBuildTrailFromRatioAndMomSignals() {
    when(signalRepository.findRrgTrail(42))
        .thenReturn(
            List.of(
                row(DATE1, "TECH", SignalType.RRG_RATIO, "1.05"),
                row(DATE1, "TECH", SignalType.RRG_MOM, "1.02"),
                row(DATE2, "TECH", SignalType.RRG_RATIO, "1.08"),
                row(DATE2, "TECH", SignalType.RRG_MOM, "1.03"),
                row(DATE2, "TECH", SignalType.RRG_QUADRANT, "4")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.TECH, "Technology", 1)));

    RrgResponse response = rrgService.getLatest();

    assertThat(response.categories()).hasSize(1);
    RrgCategoryEntry tech = response.categories().getFirst();
    assertThat(tech.id()).isEqualTo("TECH");
    assertThat(tech.name()).isEqualTo("Technology");
    assertThat(tech.quadrant()).isEqualTo(4);

    // Trail only includes dates with both ratio AND mom
    assertThat(tech.trail()).hasSize(2);
    assertThat(tech.trail().get(0).date()).isEqualTo(DATE1);
    assertThat(tech.trail().get(0).ratio()).isEqualByComparingTo("1.05");
    assertThat(tech.trail().get(0).momentum()).isEqualByComparingTo("1.02");
    assertThat(tech.trail().get(1).date()).isEqualTo(DATE2);
  }

  @Test
  @DisplayName("getLatest uses latest date's quadrant signal")
  void shouldUseLatestDateQuadrant() {
    when(signalRepository.findRrgTrail(42))
        .thenReturn(
            List.of(
                row(DATE1, "TECH", SignalType.RRG_QUADRANT, "1"), // older: Lagging
                row(DATE2, "TECH", SignalType.RRG_QUADRANT, "4"), // newer: Leading
                row(DATE1, "TECH", SignalType.RRG_RATIO, "1.00"),
                row(DATE1, "TECH", SignalType.RRG_MOM, "1.00"),
                row(DATE2, "TECH", SignalType.RRG_RATIO, "1.05"),
                row(DATE2, "TECH", SignalType.RRG_MOM, "1.03")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.TECH, "Technology", 1)));

    RrgResponse response = rrgService.getLatest();

    assertThat(response.categories().getFirst().quadrant()).isEqualTo(4);
  }

  @Test
  @DisplayName("getLatest sets response date to latest signal date in the trail")
  void shouldSetResponseDateToLatestSignalDate() {
    when(signalRepository.findRrgTrail(42))
        .thenReturn(
            List.of(
                row(DATE1, "TECH", SignalType.RRG_RATIO, "1.00"),
                row(DATE1, "TECH", SignalType.RRG_MOM, "1.00"),
                row(DATE3, "TECH", SignalType.RRG_RATIO, "1.10"),
                row(DATE3, "TECH", SignalType.RRG_MOM, "1.05")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.TECH, "Technology", 1)));

    RrgResponse response = rrgService.getLatest();

    assertThat(response.date()).isEqualTo(DATE3);
  }

  @Test
  @DisplayName("getLatest skips categories not present in the category map")
  void shouldSkipCategoriesNotInCategoryMap() {
    when(signalRepository.findRrgTrail(42))
        .thenReturn(
            List.of(
                row(DATE1, "TECH", SignalType.RRG_RATIO, "1.05"),
                row(DATE1, "TECH", SignalType.RRG_MOM, "1.02"),
                row(DATE1, "SEMI", SignalType.RRG_RATIO, "1.10"), // sub-sector, not in map
                row(DATE1, "SEMI", SignalType.RRG_MOM, "1.04")));
    // Only TECH in active categories — SEMI is not returned
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.TECH, "Technology", 1)));

    RrgResponse response = rrgService.getLatest();

    assertThat(response.categories()).hasSize(1);
    assertThat(response.categories().getFirst().id()).isEqualTo("TECH");
  }

  @Test
  @DisplayName("getLatest sorts entries by category displayOrder")
  void shouldSortEntriesByDisplayOrder() {
    when(signalRepository.findRrgTrail(42))
        .thenReturn(
            List.of(
                row(DATE1, "FINL", SignalType.RRG_RATIO, "1.01"),
                row(DATE1, "FINL", SignalType.RRG_MOM, "1.00"),
                row(DATE1, "TECH", SignalType.RRG_RATIO, "1.05"),
                row(DATE1, "TECH", SignalType.RRG_MOM, "1.02")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(
            List.of(
                category(CategoryId.TECH, "Technology", 1),
                category(CategoryId.FINL, "Financials", 3))); // FINL has higher displayOrder

    RrgResponse response = rrgService.getLatest();

    assertThat(response.categories()).hasSize(2);
    assertThat(response.categories().get(0).id()).isEqualTo("TECH"); // displayOrder=1 comes first
    assertThat(response.categories().get(1).id()).isEqualTo("FINL"); // displayOrder=3 comes second
  }

  @Test
  @DisplayName("getLatest trail excludes dates with ratio but no momentum (or vice versa)")
  void shouldOnlyIncludeTrailPointsWithBothRatioAndMomentum() {
    when(signalRepository.findRrgTrail(42))
        .thenReturn(
            List.of(
                row(DATE1, "TECH", SignalType.RRG_RATIO, "1.05"), // ratio only — excluded
                row(DATE2, "TECH", SignalType.RRG_RATIO, "1.08"), // both — included
                row(DATE2, "TECH", SignalType.RRG_MOM, "1.03"),
                row(DATE3, "TECH", SignalType.RRG_MOM, "1.04"))); // mom only — excluded
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.TECH, "Technology", 1)));

    RrgResponse response = rrgService.getLatest();

    assertThat(response.categories().getFirst().trail()).hasSize(1);
    assertThat(response.categories().getFirst().trail().getFirst().date()).isEqualTo(DATE2);
  }
}
