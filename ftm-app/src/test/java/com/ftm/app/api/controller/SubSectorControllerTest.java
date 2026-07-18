package com.ftm.app.api.controller;

import static org.instancio.Select.field;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ftm.app.api.dto.SubSectorSummaryDto;
import com.ftm.app.api.exceptions.GlobalExceptionHandler;
import com.ftm.app.category.service.SubSectorService;
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
class SubSectorControllerTest {

  @Mock SubSectorService subSectorService;

  MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(new SubSectorController(subSectorService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  @DisplayName("GET /sub-sectors returns list using default parent TECH")
  void shouldReturnSubSectorsForDefaultParent() throws Exception {
    SubSectorSummaryDto semi =
        Instancio.of(SubSectorSummaryDto.class)
            .set(field(SubSectorSummaryDto::id), "SEMI")
            .set(field(SubSectorSummaryDto::parentId), "TECH")
            .create();
    when(subSectorService.getSubSectors("TECH")).thenReturn(List.of(semi));

    mockMvc
        .perform(get("/sub-sectors"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].id").value("SEMI"))
        .andExpect(jsonPath("$[0].parentId").value("TECH"));
  }

  @Test
  @DisplayName("GET /sub-sectors?parent=FINL returns sub-sectors for FINL")
  void shouldReturnSubSectorsForGivenParent() throws Exception {
    SubSectorSummaryDto bank =
        Instancio.of(SubSectorSummaryDto.class)
            .set(field(SubSectorSummaryDto::id), "FINL_BANK")
            .set(field(SubSectorSummaryDto::parentId), "FINL")
            .create();
    when(subSectorService.getSubSectors("FINL")).thenReturn(List.of(bank));

    mockMvc
        .perform(get("/sub-sectors").param("parent", "FINL"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value("FINL_BANK"));
  }

  @Test
  @DisplayName("GET /sub-sectors returns empty list when no sub-sectors exist")
  void shouldReturnEmptyList() throws Exception {
    when(subSectorService.getSubSectors("TECH")).thenReturn(List.of());

    mockMvc
        .perform(get("/sub-sectors"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
  }

  @Test
  @DisplayName("GET /sub-sectors?parent=tech normalises lowercase to uppercase")
  void shouldNormaliseLowercaseParentToUppercase() throws Exception {
    SubSectorSummaryDto semi =
        Instancio.of(SubSectorSummaryDto.class)
            .set(field(SubSectorSummaryDto::id), "SEMI")
            .set(field(SubSectorSummaryDto::parentId), "TECH")
            .create();
    when(subSectorService.getSubSectors("TECH")).thenReturn(List.of(semi));

    mockMvc
        .perform(get("/sub-sectors").param("parent", "tech"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value("SEMI"));
  }
}
