package com.ftm.app.api.controller;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ftm.app.category.service.SubSectorService;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

// Full Spring context required: WebMvcConfig adds /api/v1 prefix and wires HandlerMethodValidator
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
class SubSectorControllerIT {

  @Autowired WebApplicationContext webApplicationContext;

  @MockitoBean SubSectorService subSectorService;

  MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
  }

  @Test
  @DisplayName("GET /api/v1/sub-sectors?parent=!!invalid returns 422 for bad characters")
  void shouldReturn422ForInvalidParent() throws Exception {
    mockMvc
        .perform(get("/api/v1/sub-sectors").param("parent", "!!invalid"))
        .andExpect(status().isUnprocessableEntity());
  }

  @Test
  @DisplayName("GET /api/v1/sub-sectors?parent=tech normalises to uppercase TECH")
  void shouldNormaliseParentToUppercase() throws Exception {
    when(subSectorService.getSubSectors("TECH")).thenReturn(List.of());

    mockMvc
        .perform(get("/api/v1/sub-sectors").param("parent", "tech"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
  }

  @Test
  @DisplayName("GET /api/v1/sub-sectors?parent=FINL returns 200 for valid parent")
  void shouldReturn200ForValidParent() throws Exception {
    when(subSectorService.getSubSectors(anyString())).thenReturn(List.of());

    mockMvc.perform(get("/api/v1/sub-sectors").param("parent", "FINL")).andExpect(status().isOk());
  }
}
