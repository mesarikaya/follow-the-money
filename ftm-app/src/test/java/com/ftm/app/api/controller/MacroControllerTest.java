package com.ftm.app.api.controller;

import com.ftm.app.api.dto.MacroIndicatorsDto;
import com.ftm.app.api.dto.MacroRegimeHistoryEntry;
import com.ftm.app.api.dto.MacroResponse;
import com.ftm.app.api.service.MacroService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class MacroControllerTest {

    @Mock MacroService macroService;
    MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new MacroController(macroService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("GET /macro returns 200 OK with regime and indicators")
    void shouldReturn200WithMacroResponse() throws Exception {
        var indicators = new MacroIndicatorsDto(null, null, null, null, null, null, null);
        var history = List.of(new MacroRegimeHistoryEntry(LocalDate.now(), "RISK_ON_GROWTH"));
        when(macroService.getMacroResponse())
                .thenReturn(new MacroResponse(LocalDate.now(), "RISK_ON_GROWTH", indicators, history));

        mockMvc.perform(get("/macro"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.regime").value("RISK_ON_GROWTH"));
    }
}
