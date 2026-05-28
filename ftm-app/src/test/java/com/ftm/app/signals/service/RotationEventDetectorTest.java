package com.ftm.app.signals.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.RotationEvent;
import com.ftm.app.domain.RotationEventType;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.event.SignalsUpdatedEvent;
import com.ftm.app.signals.repository.RotationEventRepository;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RotationEventDetectorTest {

  @Mock SignalRepository signalRepository;
  @Mock RotationEventRepository rotationEventRepository;
  @Mock CategoryRepository categoryRepository;

  RotationEventDetector detector;

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final LocalDate PREV_DATE = LocalDate.of(2024, 5, 31);

  @BeforeEach
  void setUp() {
    detector = new RotationEventDetector(signalRepository, rotationEventRepository, categoryRepository);
  }

  private void stubTopLevelCategories(String... ids) {
    when(categoryRepository.findTopLevelActiveCategoryIds()).thenReturn(Set.of(ids));
  }

  private void stubQuadrants(
      Map<String, BigDecimal> current, LocalDate prevDate, Map<String, BigDecimal> previous) {
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE)).thenReturn(current);
    when(signalRepository.findPreviousSignalDate(SignalType.RRG_QUADRANT, DATE)).thenReturn(prevDate);
    if (prevDate != null) {
      when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, prevDate)).thenReturn(previous);
    }
  }

  private void stubNoCompositeBreakout() {
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE)).thenReturn(Map.of());
    when(signalRepository.findPreviousSignalDate(SignalType.COMPOSITE, DATE)).thenReturn(null);
  }

  private void stubNotDuplicate(String categoryId, RotationEventType type) {
    when(rotationEventRepository.existsForDateAndType(DATE, categoryId, type)).thenReturn(false);
  }

  // ===== Quadrant Transition Tests =====

  @Test
  @DisplayName("Lagging → Improving: inserts ENTERING_IMPROVING event")
  void shouldDetectEnteringImprovingFromLagging() {
    stubTopLevelCategories("TECH");
    stubQuadrants(Map.of("TECH", new BigDecimal("3")), PREV_DATE, Map.of("TECH", new BigDecimal("1")));
    stubNoCompositeBreakout();
    stubNotDuplicate("TECH", RotationEventType.ENTERING_IMPROVING);

    detector.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<RotationEvent> captor = ArgumentCaptor.forClass(RotationEvent.class);
    verify(rotationEventRepository).insert(captor.capture());
    RotationEvent event = captor.getValue();
    assertThat(event.eventType()).isEqualTo(RotationEventType.ENTERING_IMPROVING);
    assertThat(event.categoryId()).isEqualTo(CategoryId.TECH);
    assertThat(event.detectedDate()).isEqualTo(DATE);
    assertThat(event.confidence()).isEqualByComparingTo("0.800");
  }

  @Test
  @DisplayName("Improving → Leading: inserts ENTERING_LEADING event with 0.900 confidence")
  void shouldDetectEnteringLeadingFromImproving() {
    stubTopLevelCategories("FINL");
    stubQuadrants(Map.of("FINL", new BigDecimal("4")), PREV_DATE, Map.of("FINL", new BigDecimal("3")));
    stubNoCompositeBreakout();
    stubNotDuplicate("FINL", RotationEventType.ENTERING_LEADING);

    detector.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<RotationEvent> captor = ArgumentCaptor.forClass(RotationEvent.class);
    verify(rotationEventRepository).insert(captor.capture());
    RotationEvent event = captor.getValue();
    assertThat(event.eventType()).isEqualTo(RotationEventType.ENTERING_LEADING);
    assertThat(event.confidence()).isEqualByComparingTo("0.900");
  }

  @Test
  @DisplayName("Leading → Weakening: inserts ENTERING_WEAKENING event with 0.750 confidence")
  void shouldDetectEnteringWeakeningFromLeading() {
    stubTopLevelCategories("HLTH");
    stubQuadrants(Map.of("HLTH", new BigDecimal("2")), PREV_DATE, Map.of("HLTH", new BigDecimal("4")));
    stubNoCompositeBreakout();
    stubNotDuplicate("HLTH", RotationEventType.ENTERING_WEAKENING);

    detector.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<RotationEvent> captor = ArgumentCaptor.forClass(RotationEvent.class);
    verify(rotationEventRepository).insert(captor.capture());
    RotationEvent event = captor.getValue();
    assertThat(event.eventType()).isEqualTo(RotationEventType.ENTERING_WEAKENING);
    assertThat(event.confidence()).isEqualByComparingTo("0.750");
  }

  @Test
  @DisplayName("Weakening → Lagging: inserts ENTERING_LAGGING event with 0.800 confidence")
  void shouldDetectEnteringLaggingFromWeakening() {
    stubTopLevelCategories("ENRG");
    stubQuadrants(Map.of("ENRG", new BigDecimal("1")), PREV_DATE, Map.of("ENRG", new BigDecimal("2")));
    stubNoCompositeBreakout();
    stubNotDuplicate("ENRG", RotationEventType.ENTERING_LAGGING);

    detector.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<RotationEvent> captor = ArgumentCaptor.forClass(RotationEvent.class);
    verify(rotationEventRepository).insert(captor.capture());
    RotationEvent event = captor.getValue();
    assertThat(event.eventType()).isEqualTo(RotationEventType.ENTERING_LAGGING);
    assertThat(event.confidence()).isEqualByComparingTo("0.800");
  }

  @Test
  @DisplayName("Same quadrant (Leading → Leading): no event inserted")
  void shouldNotDetectEventWhenQuadrantUnchanged() {
    stubTopLevelCategories("TECH");
    stubQuadrants(Map.of("TECH", new BigDecimal("4")), PREV_DATE, Map.of("TECH", new BigDecimal("4")));
    stubNoCompositeBreakout();

    detector.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(rotationEventRepository, never()).insert(any());
  }

  @Test
  @DisplayName("No previous quadrant data: no transition event inserted")
  void shouldNotDetectEventWhenNoPreviousQuadrantData() {
    stubTopLevelCategories("TECH");
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("3")));
    when(signalRepository.findPreviousSignalDate(SignalType.RRG_QUADRANT, DATE)).thenReturn(null);
    stubNoCompositeBreakout();

    detector.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(rotationEventRepository, never()).insert(any());
  }

  @Test
  @DisplayName("Sub-sector category (not top-level): skipped even if quadrant transitions")
  void shouldSkipSubSectorCategories() {
    stubTopLevelCategories("TECH"); // SEMI is a sub-sector and excluded from top-level set

    // Both TECH and SEMI show a Lagging→Improving quadrant transition
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("3"), "SEMI", new BigDecimal("3")));
    when(signalRepository.findPreviousSignalDate(SignalType.RRG_QUADRANT, DATE)).thenReturn(PREV_DATE);
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, PREV_DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("1"), "SEMI", new BigDecimal("1")));
    stubNoCompositeBreakout();
    stubNotDuplicate("TECH", RotationEventType.ENTERING_IMPROVING);

    detector.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    // Only TECH fires — SEMI is skipped because it is not in topLevelCategoryIds
    ArgumentCaptor<RotationEvent> captor = ArgumentCaptor.forClass(RotationEvent.class);
    verify(rotationEventRepository).insert(captor.capture());
    assertThat(captor.getValue().categoryId()).isEqualTo(CategoryId.TECH);
  }

  @Test
  @DisplayName("Duplicate deduplication: no insert when event already exists for date+type")
  void shouldNotInsertDuplicateWhenEventAlreadyExists() {
    stubTopLevelCategories("TECH");
    stubQuadrants(Map.of("TECH", new BigDecimal("3")), PREV_DATE, Map.of("TECH", new BigDecimal("1")));
    stubNoCompositeBreakout();
    when(rotationEventRepository.existsForDateAndType(DATE, "TECH", RotationEventType.ENTERING_IMPROVING))
        .thenReturn(true); // already recorded

    detector.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(rotationEventRepository, never()).insert(any());
  }

  // ===== Composite Breakout Tests =====

  @Test
  @DisplayName("Composite breakout: inserts COMPOSITE_BREAKOUT when score crosses 0.70 from below")
  void shouldDetectCompositeBreakoutWhenScoreExceedsThreshold() {
    stubTopLevelCategories("TECH");
    // No quadrant transition
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("4")));
    when(signalRepository.findPreviousSignalDate(SignalType.RRG_QUADRANT, DATE)).thenReturn(PREV_DATE);
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, PREV_DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("4"))); // same quadrant

    // Composite crosses above 0.70
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.720")));
    when(signalRepository.findPreviousSignalDate(SignalType.COMPOSITE, DATE)).thenReturn(PREV_DATE);
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, PREV_DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.680"))); // was below threshold
    stubNotDuplicate("TECH", RotationEventType.COMPOSITE_BREAKOUT);

    detector.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<RotationEvent> captor = ArgumentCaptor.forClass(RotationEvent.class);
    verify(rotationEventRepository).insert(captor.capture());
    RotationEvent event = captor.getValue();
    assertThat(event.eventType()).isEqualTo(RotationEventType.COMPOSITE_BREAKOUT);
    assertThat(event.categoryId()).isEqualTo(CategoryId.TECH);
    assertThat(event.confidence()).isEqualByComparingTo("0.720"); // min(score, 1.0)
  }

  @Test
  @DisplayName("Composite already above 0.70: no COMPOSITE_BREAKOUT event")
  void shouldNotDetectBreakoutWhenAlreadyAboveThreshold() {
    stubTopLevelCategories("TECH");
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("4")));
    when(signalRepository.findPreviousSignalDate(SignalType.RRG_QUADRANT, DATE)).thenReturn(PREV_DATE);
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, PREV_DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("4")));

    // Previous composite already above threshold — not a new breakout
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.750")));
    when(signalRepository.findPreviousSignalDate(SignalType.COMPOSITE, DATE)).thenReturn(PREV_DATE);
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, PREV_DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.720"))); // was already above 0.70

    detector.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(rotationEventRepository, never()).insert(any());
  }

  @Test
  @DisplayName("Composite below 0.70: no COMPOSITE_BREAKOUT event")
  void shouldNotDetectBreakoutWhenScoreBelowThreshold() {
    stubTopLevelCategories("TECH");
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("4")));
    when(signalRepository.findPreviousSignalDate(SignalType.RRG_QUADRANT, DATE)).thenReturn(PREV_DATE);
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, PREV_DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("4")));

    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.650"))); // still below 0.70
    when(signalRepository.findPreviousSignalDate(SignalType.COMPOSITE, DATE)).thenReturn(PREV_DATE);
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, PREV_DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.600")));

    detector.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(rotationEventRepository, never()).insert(any());
  }

}
