package com.ftm.app.api.controller;

import com.ftm.app.api.dto.SubSectorSummaryDto;
import com.ftm.app.category.service.SubSectorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/sub-sectors")
@Validated
@Tag(name = "Sub-Sectors", description = "Thematic sub-sector ETFs within a parent GICS sector")
public class SubSectorController {

  private final SubSectorService subSectorService;

  public SubSectorController(SubSectorService subSectorService) {
    this.subSectorService = subSectorService;
  }

  @GetMapping
  @Operation(summary = "All sub-sectors for the given parent category, sorted by RS-60 descending")
  public List<SubSectorSummaryDto> getSubSectors(
      @RequestParam(defaultValue = "TECH")
          @Pattern(
              regexp = "[A-Za-z0-9_]{1,20}",
              message = "parent must be 1–20 alphanumeric characters")
          String parent) {
    return subSectorService.getSubSectors(parent.toUpperCase());
  }
}
