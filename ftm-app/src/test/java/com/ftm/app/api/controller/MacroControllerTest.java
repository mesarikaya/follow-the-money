package com.ftm.app.api.controller;

import static org.instancio.Select.field;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ftm.app.api.dto.MacroRegimeHistoryEntry;
import com.ftm.app.api.dto.MacroResponse;
import com.ftm.app.api.dto.MacroSeriesPoint;
import com.ftm.app.api.exceptions.GlobalExceptionHandler;
import com.ftm.app.macro.service.MacroService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
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
class MacroControllerTest {

  @Mock MacroService macroService;
  MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(new MacroController(macroService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  @DisplayName("GET /macro returns 200 OK with regime and indicators")
  void shouldReturn200WithMacroResponse() throws Exception {
    var macroResponse = Instancio.of(MacroResponse.class).create();
    when(macroService.getMacroResponse()).thenReturn(macroResponse);

    mockMvc
        .perform(get("/macro"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.regime").value(macroResponse.regime()));
  }

  @Test
  @DisplayName(
      "GET /macro response includes asOfDate, regimeHistory, and macroFitByCategory fields")
  void shouldIncludeFullResponseStructure() throws Exception {
    LocalDate today = LocalDate.of(2024, 6, 1);
    MacroRegimeHistoryEntry historyEntry =
        Instancio.of(MacroRegimeHistoryEntry.class)
            .set(field(MacroRegimeHistoryEntry::date), today.minusDays(7))
            .set(field(MacroRegimeHistoryEntry::regime), "RISK_ON_GROWTH")
            .create();
    MacroResponse response =
        Instancio.of(MacroResponse.class)
            .set(field(MacroResponse::asOfDate), today)
            .set(field(MacroResponse::regime), "RISK_ON_GROWTH")
            .set(field(MacroResponse::regimeHistory), List.of(historyEntry))
            .set(field(MacroResponse::macroFitByCategory), Map.of("TECH", new BigDecimal("0.78")))
            .create();
    when(macroService.getMacroResponse()).thenReturn(response);

    mockMvc
        .perform(get("/macro"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.asOfDate").value("2024-06-01"))
        .andExpect(jsonPath("$.regime").value("RISK_ON_GROWTH"))
        .andExpect(jsonPath("$.regimeHistory.length()").value(1))
        .andExpect(jsonPath("$.regimeHistory[0].regime").value("RISK_ON_GROWTH"))
        .andExpect(jsonPath("$.macroFitByCategory.TECH").value(0.78));
  }

  @Test
  @DisplayName("GET /macro returns 500 when service throws")
  void shouldReturn500OnServiceError() throws Exception {
    when(macroService.getMacroResponse()).thenThrow(new RuntimeException("DB unavailable"));

    mockMvc.perform(get("/macro")).andExpect(status().isInternalServerError());
  }

  @Test
  @DisplayName("GET /macro/history returns 200 with map of series points")
  void shouldReturnMacroHistory() throws Exception {
    LocalDate date = LocalDate.of(2024, 1, 15);
    Map<String, List<MacroSeriesPoint>> history =
        Map.of(
            "VIXCLS", List.of(new MacroSeriesPoint(date, new BigDecimal("18.50"))),
            "T10Y2Y", List.of(new MacroSeriesPoint(date, new BigDecimal("-0.40"))));
    when(macroService.getMacroHistory(365)).thenReturn(history);

    mockMvc
        .perform(get("/macro/history?days=365"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.VIXCLS").isArray())
        .andExpect(jsonPath("$.VIXCLS[0].value").value(18.50));
  }
}
