package com.ftm.app.api.controller;

import static org.instancio.Select.field;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ftm.app.api.dto.RotationResponse;
import com.ftm.app.api.exceptions.GlobalExceptionHandler;
import com.ftm.app.api.service.RotationService;
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
class RotationControllerTest {

  @Mock RotationService rotationService;

  MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(new RotationController(rotationService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  @DisplayName("GET /rotation returns 200 with rotation data")
  void shouldReturnRotationData() throws Exception {
    RotationResponse response =
        Instancio.of(RotationResponse.class)
            .set(field(RotationResponse::topLeaders), List.of())
            .set(field(RotationResponse::bottomLaggards), List.of())
            .set(field(RotationResponse::recentEvents), List.of())
            .create();
    when(rotationService.getLatest()).thenReturn(response);

    mockMvc
        .perform(get("/rotation"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.topLeaders").isArray())
        .andExpect(jsonPath("$.bottomLaggards").isArray())
        .andExpect(jsonPath("$.recentEvents").isArray());
  }
}
