package com.ftm.app.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.instancio.Select.field;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.ftm.app.api.dto.RotationResponse;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.CategoryType;
import com.ftm.app.domain.RotationEvent;
import com.ftm.app.domain.RotationEventType;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.RotationEventRepository;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
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
class RotationServiceTest {

  @Mock CategoryRepository categoryRepository;
  @Mock SignalRepository signalRepository;
  @Mock RotationEventRepository rotationEventRepository;
  @InjectMocks RotationService rotationService;

  private Category techCategory() {
    return Instancio.of(Category.class)
        .set(field(Category::id), CategoryId.TECH)
        .set(field(Category::name), "Technology")
        .set(field(Category::type), CategoryType.EQUITY_SECTOR)
        .set(field(Category::active), true)
        .set(field(Category::parentId), null)
        .create();
  }

  @Test
  @DisplayName("getLatest returns rotation response with empty lists when no signals")
  void shouldReturnEmptyResponseWhenNoSignals() {
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc()).thenReturn(List.of());
    when(signalRepository.findLatestByType(SignalType.COMPOSITE)).thenReturn(Map.of());
    when(signalRepository.findLatestByType(SignalType.RS_60)).thenReturn(Map.of());
    when(signalRepository.findLatestByType(SignalType.RRG_QUADRANT)).thenReturn(Map.of());
    when(rotationEventRepository.findRecentEvents(any(LocalDate.class))).thenReturn(List.of());

    RotationResponse response = rotationService.getLatest();

    assertThat(response.topLeaders()).isEmpty();
    assertThat(response.bottomLaggards()).isEmpty();
    assertThat(response.recentEvents()).isEmpty();
  }

  @Test
  @DisplayName("getLatest ranks categories by composite score")
  void shouldRankByCompositeScore() {
    Category tech = techCategory();
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc()).thenReturn(List.of(tech));
    when(signalRepository.findLatestByType(SignalType.COMPOSITE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.85")));
    when(signalRepository.findLatestByType(SignalType.RS_60)).thenReturn(Map.of());
    when(signalRepository.findLatestByType(SignalType.RRG_QUADRANT)).thenReturn(Map.of());
    when(rotationEventRepository.findRecentEvents(any(LocalDate.class))).thenReturn(List.of());

    RotationResponse response = rotationService.getLatest();

    assertThat(response.topLeaders()).hasSize(1);
    assertThat(response.topLeaders().get(0).categoryId()).isEqualTo("TECH");
    assertThat(response.topLeaders().get(0).compositeScore()).isEqualByComparingTo("0.85");
  }

  @Test
  @DisplayName("getLatest maps rotation events to entries with category names")
  void shouldMapRotationEventsWithCategoryNames() {
    Category tech = techCategory();
    RotationEvent event =
        new RotationEvent(
            LocalDate.now(),
            CategoryId.TECH,
            RotationEventType.FLOW_SURGE,
            new BigDecimal("0.75"),
            "{}",
            "Strong inflows");
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc()).thenReturn(List.of(tech));
    when(signalRepository.findLatestByType(SignalType.COMPOSITE)).thenReturn(Map.of());
    when(signalRepository.findLatestByType(SignalType.RS_60)).thenReturn(Map.of());
    when(signalRepository.findLatestByType(SignalType.RRG_QUADRANT)).thenReturn(Map.of());
    when(rotationEventRepository.findRecentEvents(any(LocalDate.class))).thenReturn(List.of(event));

    RotationResponse response = rotationService.getLatest();

    assertThat(response.recentEvents()).hasSize(1);
    assertThat(response.recentEvents().get(0).categoryId()).isEqualTo("TECH");
    assertThat(response.recentEvents().get(0).categoryName()).isEqualTo("Technology");
    assertThat(response.recentEvents().get(0).eventType()).isEqualTo("FLOW_SURGE");
  }
}
