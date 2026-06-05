package com.ftm.app.api.controller;

import static org.instancio.Select.field;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ftm.app.api.dto.SignalHistoryDto;
import com.ftm.app.api.exceptions.GlobalExceptionHandler;
import com.ftm.app.api.mapper.SignalHistoryMapper;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.signals.service.SignalComputationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.instancio.Instancio;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class SignalControllerTest {

  @Mock SignalRepository signalRepository;
  @Mock SignalHistoryMapper signalHistoryMapper;
  @Mock SignalComputationService signalComputationService;

  MockMvc mockMvc;

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new SignalController(
                    signalRepository, signalHistoryMapper, signalComputationService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  @DisplayName("GET /signals/{categoryId} returns 200 with signal history list")
  void shouldReturnSignalHistory() throws Exception {
    SignalRepository.HistoryRow row =
        Instancio.of(SignalRepository.HistoryRow.class)
            .set(field(SignalRepository.HistoryRow::signalDate), DATE)
            .set(field(SignalRepository.HistoryRow::signalType), SignalType.COMPOSITE)
            .set(field(SignalRepository.HistoryRow::value), new BigDecimal("0.750"))
            .create();
    SignalHistoryDto dto =
        new SignalHistoryDto(DATE, SignalType.COMPOSITE, new BigDecimal("0.750"), row.computedAt());

    when(signalRepository.findByCategoryId("TECH", 0)).thenReturn(List.of(row));
    when(signalHistoryMapper.toDto(row)).thenReturn(dto);

    mockMvc
        .perform(get("/signals/TECH"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$").isArray())
        .andExpect(jsonPath("$[0].signalType").value("COMPOSITE"))
        .andExpect(jsonPath("$[0].signalDate").value("2024-06-01"));
  }

  @Test
  @DisplayName("GET /signals/{categoryId} uppercases the category ID before lookup")
  void shouldUppercaseCategoryId() throws Exception {
    when(signalRepository.findByCategoryId("TECH", 0)).thenReturn(List.of());

    mockMvc.perform(get("/signals/tech")).andExpect(status().isOk());

    verify(signalRepository).findByCategoryId("TECH", 0);
  }

  @Test
  @DisplayName("GET /signals/{categoryId} returns 200 with empty list when no signals exist")
  void shouldReturnEmptyListWhenNoSignals() throws Exception {
    when(signalRepository.findByCategoryId("FINL", 0)).thenReturn(List.of());

    mockMvc
        .perform(get("/signals/FINL"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$").isArray())
        .andExpect(jsonPath("$").isEmpty());
  }

  @Test
  @DisplayName("GET /signals/{categoryId}?days=90 filters results to recent 90 days")
  void shouldPassDaysParameterToRepository() throws Exception {
    when(signalRepository.findByCategoryId("XLK", 90)).thenReturn(List.of());

    mockMvc.perform(get("/signals/XLK?days=90")).andExpect(status().isOk());

    verify(signalRepository).findByCategoryId("XLK", 90);
  }

  @Test
  @DisplayName("POST /signals/compute returns 200 with status message")
  void shouldTriggerSignalComputation() throws Exception {
    mockMvc
        .perform(post("/signals/compute"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("Signal computation completed"));

    verify(signalComputationService).computeAndStore();
  }
}
