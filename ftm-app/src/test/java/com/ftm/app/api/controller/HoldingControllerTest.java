package com.ftm.app.api.controller;

import static org.instancio.Select.field;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.ftm.app.api.dto.HoldingDto;
import com.ftm.app.api.dto.HoldingUpdateRequest;
import com.ftm.app.api.dto.HoldingsUploadResponse;
import com.ftm.app.api.exceptions.GlobalExceptionHandler;
import com.ftm.app.portfolio.service.HoldingUploadService;
import java.math.BigDecimal;
import java.util.List;
import java.util.NoSuchElementException;
import org.instancio.Instancio;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class HoldingControllerTest {

  @Mock HoldingUploadService holdingUploadService;

  MockMvc mockMvc;
  ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(new HoldingController(holdingUploadService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  private HoldingDto sampleHolding(String ticker, String categoryId) {
    return Instancio.of(HoldingDto.class)
        .set(field(HoldingDto::ticker), ticker)
        .set(field(HoldingDto::categoryId), categoryId)
        .create();
  }

  @Test
  @DisplayName("GET /portfolio/holdings/template returns CSV file")
  void shouldReturnCsvTemplate() throws Exception {
    when(holdingUploadService.generateCsvTemplate())
        .thenReturn("ticker,name,quantity,currency,avg_cost\n");

    mockMvc
        .perform(get("/portfolio/holdings/template"))
        .andExpect(status().isOk())
        .andExpect(
            header()
                .string("Content-Disposition", "attachment; filename=\"holdings-template.csv\""))
        .andExpect(content().contentType("text/csv"));
  }

  @Test
  @DisplayName("GET /portfolio/holdings returns all holdings")
  void shouldReturnAllHoldings() throws Exception {
    when(holdingUploadService.getHoldings())
        .thenReturn(List.of(sampleHolding("XLK", "TECH"), sampleHolding("GLD", "GOLD")));

    mockMvc
        .perform(get("/portfolio/holdings"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2));
  }

  @Test
  @DisplayName("POST /portfolio/holdings/upload processes CSV and returns summary")
  void shouldUploadHoldings() throws Exception {
    String csvContent = "ticker,name,quantity,currency,avg_cost\nXLK,Tech ETF,10,USD,195.50\n";
    MockMultipartFile file =
        new MockMultipartFile("file", "holdings.csv", "text/csv", csvContent.getBytes());
    HoldingsUploadResponse response =
        Instancio.of(HoldingsUploadResponse.class)
            .set(field(HoldingsUploadResponse::totalAccepted), 1)
            .create();
    when(holdingUploadService.upload(csvContent)).thenReturn(response);

    mockMvc
        .perform(multipart("/portfolio/holdings/upload").file(file))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalAccepted").value(1));
  }

  @Test
  @DisplayName("PATCH /portfolio/holdings/{ticker} updates holding and returns 200")
  void shouldUpdateHolding() throws Exception {
    HoldingUpdateRequest request =
        new HoldingUpdateRequest(new BigDecimal("15.0"), new BigDecimal("200.00"), null);
    HoldingDto updated = sampleHolding("XLK", "TECH");
    when(holdingUploadService.updateHolding(eq("XLK"), any(HoldingUpdateRequest.class)))
        .thenReturn(updated);

    mockMvc
        .perform(
            patch("/portfolio/holdings/XLK")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk());
  }

  @Test
  @DisplayName("PATCH /portfolio/holdings/{ticker} returns 404 for unknown ticker")
  void shouldReturn404ForUnknownTicker() throws Exception {
    HoldingUpdateRequest request = new HoldingUpdateRequest(new BigDecimal("5.0"), null, null);
    when(holdingUploadService.updateHolding(eq("UNKNOWN"), any()))
        .thenThrow(new NoSuchElementException("No holding found for ticker: UNKNOWN"));

    mockMvc
        .perform(
            patch("/portfolio/holdings/UNKNOWN")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isNotFound());
  }
}
