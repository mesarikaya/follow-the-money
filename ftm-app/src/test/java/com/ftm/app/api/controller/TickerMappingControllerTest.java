package com.ftm.app.api.controller;

import static org.instancio.Select.field;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ftm.app.api.dto.TickerMappingDto;
import com.ftm.app.api.dto.TickerMappingRequest;
import com.ftm.app.api.exceptions.GlobalExceptionHandler;
import com.ftm.app.api.mapper.TickerMappingMapper;
import com.ftm.app.portfolio.domain.TickerMapping;
import com.ftm.app.portfolio.repository.TickerMappingRepository;
import com.ftm.app.portfolio.service.HoldingClassificationService;
import java.time.OffsetDateTime;
import java.util.List;
import org.instancio.Instancio;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class TickerMappingControllerTest {

  private static final OffsetDateTime UPDATED_AT = OffsetDateTime.parse("2025-01-01T00:00:00Z");
  @Mock TickerMappingRepository tickerMappingRepository;
  @Mock HoldingClassificationService holdingClassificationService;
  @Mock TickerMappingMapper tickerMappingMapper;
  MockMvc mockMvc;
  ObjectMapper objectMapper = new ObjectMapper();

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new TickerMappingController(
                    tickerMappingRepository, holdingClassificationService, tickerMappingMapper))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  @DisplayName("GET /admin/ticker-mappings returns all mappings")
  void shouldReturnAllMappings() throws Exception {
    TickerMapping xlk =
        Instancio.of(TickerMapping.class)
            .set(field(TickerMapping::ticker), "XLK")
            .set(field(TickerMapping::categoryId), "TECH")
            .create();
    TickerMappingDto xlkDto = new TickerMappingDto("XLK", "TECH", null, UPDATED_AT);
    when(tickerMappingRepository.findAll()).thenReturn(List.of(xlk));
    when(tickerMappingMapper.toDto(xlk)).thenReturn(xlkDto);

    mockMvc
        .perform(get("/admin/ticker-mappings"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].ticker").value("XLK"))
        .andExpect(jsonPath("$[0].categoryId").value("TECH"));
  }

  @Test
  @DisplayName("GET /admin/ticker-mappings returns empty list when no mappings exist")
  void shouldReturnEmptyList() throws Exception {
    when(tickerMappingRepository.findAll()).thenReturn(List.of());

    mockMvc
        .perform(get("/admin/ticker-mappings"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
  }

  @Test
  @DisplayName("POST /admin/ticker-mappings creates mapping and returns 200")
  void shouldUpsertMapping() throws Exception {
    TickerMappingRequest request = new TickerMappingRequest("AAPL", "TECH", "Apple Inc.");
    TickerMapping saved =
        Instancio.of(TickerMapping.class)
            .set(field(TickerMapping::ticker), "AAPL")
            .set(field(TickerMapping::categoryId), "TECH")
            .set(field(TickerMapping::notes), "Apple Inc.")
            .create();
    TickerMappingDto savedDto = new TickerMappingDto("AAPL", "TECH", "Apple Inc.", UPDATED_AT);
    when(tickerMappingRepository.findAll()).thenReturn(List.of(saved));
    when(tickerMappingMapper.toDto(any(TickerMapping.class))).thenReturn(savedDto);

    mockMvc
        .perform(
            post("/admin/ticker-mappings")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ticker").value("AAPL"))
        .andExpect(jsonPath("$.categoryId").value("TECH"));

    verify(tickerMappingRepository).upsert("AAPL", "TECH", "Apple Inc.");
    verify(holdingClassificationService).refreshCache();
  }

  @Test
  @DisplayName("POST /admin/ticker-mappings returns 422 for blank ticker")
  void shouldReturn422ForBlankTicker() throws Exception {
    TickerMappingRequest request = new TickerMappingRequest("", "TECH", null);

    mockMvc
        .perform(
            post("/admin/ticker-mappings")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isUnprocessableEntity());
  }

  @Test
  @DisplayName("DELETE /admin/ticker-mappings/{ticker} returns 204 when deleted")
  void shouldDeleteMapping() throws Exception {
    when(tickerMappingRepository.delete("XLK")).thenReturn(1);

    mockMvc.perform(delete("/admin/ticker-mappings/XLK")).andExpect(status().isNoContent());

    verify(holdingClassificationService).refreshCache();
  }

  @Test
  @DisplayName("DELETE /api/v1/admin/ticker-mappings/{ticker} returns 404 when not found")
  void shouldReturn404WhenNotFound() throws Exception {
    when(tickerMappingRepository.delete("UNKNOWN")).thenReturn(0);

    mockMvc.perform(delete("/admin/ticker-mappings/UNKNOWN")).andExpect(status().isNotFound());
  }
}
