package com.ftm.app.api.controller;

import com.ftm.app.api.dto.HoldingDto;
import com.ftm.app.api.dto.HoldingUpdateRequest;
import com.ftm.app.api.dto.HoldingsUploadResponse;
import com.ftm.app.portfolio.service.HoldingUploadService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/portfolio/holdings")
public class HoldingController {

    private final HoldingUploadService holdingUploadService;

    public HoldingController(HoldingUploadService holdingUploadService) {
        this.holdingUploadService = holdingUploadService;
    }

    @Operation(summary = "Download CSV template for bulk holdings upload")
    @GetMapping("/template")
    public ResponseEntity<byte[]> downloadTemplate() {
        byte[] csvBytes = holdingUploadService.generateCsvTemplate().getBytes(StandardCharsets.UTF_8);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv"));
        headers.setContentDisposition(ContentDisposition.attachment().filename("holdings-template.csv").build());
        return ResponseEntity.ok().headers(headers).body(csvBytes);
    }

    @Operation(summary = "Upload all holdings from a CSV file (replaces existing holdings)")
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<HoldingsUploadResponse> uploadHoldings(
            @RequestParam("file") MultipartFile file) throws IOException {
        String csvContent = new String(file.getBytes(), StandardCharsets.UTF_8);
        HoldingsUploadResponse response = holdingUploadService.upload(csvContent);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "List all current holdings")
    @GetMapping
    public List<HoldingDto> getHoldings() {
        return holdingUploadService.getHoldings();
    }

    @Operation(summary = "Update quantity and/or average cost for an existing holding")
    @PatchMapping("/{ticker}")
    public ResponseEntity<HoldingDto> updateHolding(
            @PathVariable String ticker,
            @Valid @RequestBody HoldingUpdateRequest request) {
        HoldingDto updated = holdingUploadService.updateHolding(ticker, request);
        return ResponseEntity.ok(updated);
    }
}
