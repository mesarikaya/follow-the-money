package com.ftm.app.api.controller;

import com.ftm.app.api.dto.SubSectorSummaryDto;
import com.ftm.app.api.service.SubSectorService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/sub-sectors")
public class SubSectorController {

  private final SubSectorService subSectorService;

  public SubSectorController(SubSectorService subSectorService) {
    this.subSectorService = subSectorService;
  }

  @GetMapping
  public List<SubSectorSummaryDto> getSubSectors(
      @RequestParam(defaultValue = "TECH") String parent) {
    return subSectorService.getSubSectors(parent);
  }
}
