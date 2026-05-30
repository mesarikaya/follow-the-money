package com.ftm.app.api.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import static org.instancio.Select.field;

import com.ftm.app.api.dto.RrgCategoryEntry;
import com.ftm.app.api.dto.RrgResponse;
import com.ftm.app.api.exceptions.GlobalExceptionHandler;
import com.ftm.app.api.service.RrgService;
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
class RrgControllerTest {

  @Mock RrgService rrgService;

  MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(new RrgController(rrgService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  @DisplayName("GET /rrg returns 200 with date and categories array")
  void shouldReturnRrgData() throws Exception {
    RrgCategoryEntry techEntry =
        Instancio.of(RrgCategoryEntry.class)
            .set(field(RrgCategoryEntry::id), "TECH")
            .set(field(RrgCategoryEntry::name), "Technology")
            .set(field(RrgCategoryEntry::quadrant), 4)
            .set(field(RrgCategoryEntry::trail), List.of())
            .create();
    RrgResponse response = new RrgResponse(LocalDate.of(2024, 6, 1), List.of(techEntry));
    when(rrgService.getLatest()).thenReturn(response);

    mockMvc
        .perform(get("/rrg"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.date").value("2024-06-01"))
        .andExpect(jsonPath("$.categories").isArray())
        .andExpect(jsonPath("$.categories[0].id").value("TECH"))
        .andExpect(jsonPath("$.categories[0].name").value("Technology"))
        .andExpect(jsonPath("$.categories[0].quadrant").value(4));
  }

  @Test
  @DisplayName("GET /rrg returns 200 with empty categories when no data")
  void shouldReturnEmptyWhenNoData() throws Exception {
    RrgResponse response = new RrgResponse(LocalDate.now(), List.of());
    when(rrgService.getLatest()).thenReturn(response);

    mockMvc
        .perform(get("/rrg"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.categories").isArray())
        .andExpect(jsonPath("$.categories").isEmpty());
  }
}
