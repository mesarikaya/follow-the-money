package com.ftm.app.api.controller;

import com.ftm.app.api.dto.TickerMappingDto;
import com.ftm.app.api.dto.TickerMappingRequest;
import com.ftm.app.api.mapper.TickerMappingMapper;
import com.ftm.app.portfolio.domain.TickerMapping;
import com.ftm.app.portfolio.repository.TickerMappingRepository;
import com.ftm.app.portfolio.service.HoldingClassificationService;
import com.ftm.app.portfolio.service.HoldingUploadService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("admin/ticker-mappings")
public class TickerMappingController {

  private static final Logger log = LoggerFactory.getLogger(TickerMappingController.class);

  private final TickerMappingRepository tickerMappingRepository;
  private final HoldingClassificationService holdingClassificationService;
  private final HoldingUploadService holdingUploadService;
  private final TickerMappingMapper tickerMappingMapper;

  public TickerMappingController(
      TickerMappingRepository tickerMappingRepository,
      HoldingClassificationService holdingClassificationService,
      HoldingUploadService holdingUploadService,
      TickerMappingMapper tickerMappingMapper) {
    this.tickerMappingRepository = tickerMappingRepository;
    this.holdingClassificationService = holdingClassificationService;
    this.holdingUploadService = holdingUploadService;
    this.tickerMappingMapper = tickerMappingMapper;
  }

  @Operation(summary = "List all ticker-to-category mappings")
  @GetMapping
  public List<TickerMappingDto> getAll() {
    return tickerMappingRepository.findAll().stream().map(tickerMappingMapper::toDto).toList();
  }

  @Operation(summary = "Create or update a ticker-to-category mapping")
  @PostMapping
  public ResponseEntity<TickerMappingDto> upsert(@Valid @RequestBody TickerMappingRequest request) {
    tickerMappingRepository.upsert(request.ticker(), request.categoryId(), request.notes());
    holdingClassificationService.refreshCache();
    int reclassified = holdingUploadService.reclassifyUnmappedHoldings();
    if (reclassified > 0) {
      log.info(
          "ticker mapping upsert for {}: reclassified {} holdings", request.ticker(), reclassified);
    }
    TickerMapping saved = tickerMappingRepository.findByTicker(request.ticker()).orElseThrow();
    return ResponseEntity.ok(tickerMappingMapper.toDto(saved));
  }

  @Operation(summary = "Delete a ticker mapping")
  @DeleteMapping("/{ticker}")
  public ResponseEntity<Void> delete(@PathVariable String ticker) {
    int deleted = tickerMappingRepository.delete(ticker);
    if (deleted == 0) return ResponseEntity.notFound().build();
    holdingClassificationService.refreshCache();
    return ResponseEntity.noContent().build();
  }
}
