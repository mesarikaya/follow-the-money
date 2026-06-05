package com.ftm.app.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ftm.app.api.dto.SignalHistoryDto;
import com.ftm.app.api.mapper.SignalHistoryMapper;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SignalHistoryServiceTest {

  @Mock SignalRepository signalRepository;
  @Mock SignalHistoryMapper signalHistoryMapper;
  @InjectMocks SignalHistoryService signalHistoryService;

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);

  private SignalRepository.HistoryRow row(SignalType type, BigDecimal value) {
    return new SignalRepository.HistoryRow(DATE, type, value, OffsetDateTime.now());
  }

  @Test
  @DisplayName("getHistory returns mapped DTOs for the given category and days")
  void shouldReturnMappedHistory() {
    var row = row(SignalType.COMPOSITE, new BigDecimal("0.75"));
    var dto = new SignalHistoryDto(DATE, SignalType.COMPOSITE, new BigDecimal("0.75"), row.computedAt());

    when(signalRepository.findByCategoryId("TECH", 30)).thenReturn(List.of(row));
    when(signalHistoryMapper.toDto(row)).thenReturn(dto);

    List<SignalHistoryDto> result = signalHistoryService.getHistory("TECH", 30);

    assertThat(result).hasSize(1);
    assertThat(result.get(0).signalType()).isEqualTo(SignalType.COMPOSITE);
    assertThat(result.get(0).value()).isEqualByComparingTo("0.75");
    verify(signalRepository).findByCategoryId("TECH", 30);
  }

  @Test
  @DisplayName("getHistory returns empty list when repository returns no rows")
  void shouldReturnEmptyListWhenNoHistory() {
    when(signalRepository.findByCategoryId("FINL", 0)).thenReturn(List.of());

    List<SignalHistoryDto> result = signalHistoryService.getHistory("FINL", 0);

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("getHistory passes days=0 to repository for unlimited history")
  void shouldPassDaysZeroForUnlimitedHistory() {
    when(signalRepository.findByCategoryId("ENRG", 0)).thenReturn(List.of());

    signalHistoryService.getHistory("ENRG", 0);

    verify(signalRepository).findByCategoryId("ENRG", 0);
  }

  @Test
  @DisplayName("getHistory maps multiple rows preserving order")
  void shouldMapMultipleRowsInOrder() {
    var row1 = row(SignalType.COMPOSITE, new BigDecimal("0.80"));
    var row2 = row(SignalType.RS_60,     new BigDecimal("0.65"));
    var dto1  = new SignalHistoryDto(DATE, SignalType.COMPOSITE, new BigDecimal("0.80"), row1.computedAt());
    var dto2  = new SignalHistoryDto(DATE, SignalType.RS_60,     new BigDecimal("0.65"), row2.computedAt());

    when(signalRepository.findByCategoryId("HLTH", 90)).thenReturn(List.of(row1, row2));
    when(signalHistoryMapper.toDto(row1)).thenReturn(dto1);
    when(signalHistoryMapper.toDto(row2)).thenReturn(dto2);

    List<SignalHistoryDto> result = signalHistoryService.getHistory("HLTH", 90);

    assertThat(result).hasSize(2);
    assertThat(result.get(0).signalType()).isEqualTo(SignalType.COMPOSITE);
    assertThat(result.get(1).signalType()).isEqualTo(SignalType.RS_60);
  }
}
