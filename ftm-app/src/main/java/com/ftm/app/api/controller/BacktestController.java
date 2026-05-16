package com.ftm.app.api.controller;

import com.ftm.app.api.dto.BacktestRequest;
import com.ftm.app.api.dto.BacktestResult;
import com.ftm.app.backtest.repository.BacktestRepository;
import com.ftm.app.backtest.service.BacktestEngine;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

@RestController
@RequestMapping("/backtest")
public class BacktestController {

    private static final int RECENT_RUNS_LIMIT = 10;

    private final BacktestEngine backtestEngine;
    private final BacktestRepository backtestRepository;

    public BacktestController(BacktestEngine backtestEngine, BacktestRepository backtestRepository) {
        this.backtestEngine = backtestEngine;
        this.backtestRepository = backtestRepository;
    }

    @PostMapping("/run")
    public ResponseEntity<BacktestResult> runBacktest(@Valid @RequestBody BacktestRequest request) {
        BacktestResult result = backtestEngine.run(request);
        BacktestResult saved = backtestRepository.save(result);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/{runId}")
    public BacktestResult getBacktestResult(@PathVariable UUID runId) {
        return backtestRepository.findByRunId(runId)
                .orElseThrow(() -> new NoSuchElementException("Backtest run not found: " + runId));
    }

    @GetMapping("/recent")
    public List<BacktestResult> getRecentBacktests() {
        return backtestRepository.findRecent(RECENT_RUNS_LIMIT);
    }
}
