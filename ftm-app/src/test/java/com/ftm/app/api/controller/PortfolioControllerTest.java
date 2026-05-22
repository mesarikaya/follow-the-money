package com.ftm.app.api.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ftm.app.api.dto.PortfolioEntryDto;
import com.ftm.app.api.dto.PortfolioResponse;
import com.ftm.app.api.exceptions.GlobalExceptionHandler;
import com.ftm.app.portfolio.service.PortfolioService;
import java.math.BigDecimal;
import java.util.List;
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
class PortfolioControllerTest {

  @Mock PortfolioService portfolioService;

  MockMvc mockMvc;
  ObjectMapper objectMapper = new ObjectMapper();

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(new PortfolioController(portfolioService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  private PortfolioResponse emptyPortfolio() {
    return new PortfolioResponse(List.of(), BigDecimal.ZERO, "MISALIGNED", List.of());
  }

  @Test
  @DisplayName("GET /portfolio returns 200 with portfolio response")
  void shouldReturnPortfolio() throws Exception {
    when(portfolioService.getPortfolio()).thenReturn(emptyPortfolio());

    mockMvc
        .perform(get("/portfolio"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.alignmentLabel").value("MISALIGNED"))
        .andExpect(jsonPath("$.allocations").isArray());
  }

  @Test
  @DisplayName("PUT /portfolio saves entries and returns updated portfolio")
  void shouldSavePortfolio() throws Exception {
    List<PortfolioEntryDto> entries =
        List.of(
            new PortfolioEntryDto("TECH", new BigDecimal("60.0")),
            new PortfolioEntryDto("GOLD", new BigDecimal("40.0")));
    when(portfolioService.getPortfolio()).thenReturn(emptyPortfolio());

    mockMvc
        .perform(
            put("/portfolio")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(entries)))
        .andExpect(status().isOk());

    verify(portfolioService).savePortfolio(any());
  }

  @Test
  @DisplayName("PUT /portfolio returns 422 when allocation sum is invalid")
  void shouldReturn422ForInvalidAllocationSum() throws Exception {
    List<PortfolioEntryDto> entries =
        List.of(new PortfolioEntryDto("TECH", new BigDecimal("50.0")));
    doThrow(new IllegalArgumentException("Must sum to 100%"))
        .when(portfolioService)
        .savePortfolio(any());

    mockMvc
        .perform(
            put("/portfolio")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(entries)))
        .andExpect(status().isUnprocessableEntity());
  }
}
