package com.ftm.app.ingestion.service;

import com.ftm.app.ingestion.client.FredClient;
import com.ftm.app.ingestion.client.dto.FredObservationsResponse;
import com.ftm.app.ingestion.repository.MacroIndicatorRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
public class MacroIngestionHandler {

    private static final Logger log = LoggerFactory.getLogger(MacroIngestionHandler.class);
    private static final int BACKFILL_YEARS = 7;

    private static final Set<String> FRED_SERIES =
            Set.of("T10Y2Y", "T10YIE", "VIXCLS", "DTWEXBGS", "FEDFUNDS", "DGS10", "DGS2", "DEXUSEU");

    private final FredClient fredClient;
    private final MacroIndicatorRepository macroRepo;

    public MacroIngestionHandler(FredClient fredClient, MacroIndicatorRepository macroRepo) {
        this.fredClient = fredClient;
        this.macroRepo = macroRepo;
    }

    public IngestionResult fetchAndPersist(LocalDate today) {
        int totalRows = 0;
        List<String> errors = new ArrayList<>();

        for (String seriesId : FRED_SERIES) {
            totalRows += fetchSeries(seriesId, today, errors);
        }

        return errors.isEmpty()
                ? IngestionResult.success(totalRows)
                : IngestionResult.partial(totalRows, errors);
    }

    private int fetchSeries(String seriesId, LocalDate today, List<String> errors) {
        try {
            LocalDate from = macroRepo.findMaxObservationDate(seriesId)
                    .map(d -> d.plusDays(1))
                    .orElse(today.minusYears(BACKFILL_YEARS));
            if (!from.isBefore(today)) return 0;

            List<MacroIndicatorRepository.Row> rows = fredClient
                    .fetchObservations(seriesId, from, today).stream()
                    .map(o -> toRow(seriesId, o))
                    .toList();

            return macroRepo.batchInsert(rows);
        } catch (Exception ex) {
            log.warn("FRED series {} failed: {}", seriesId, ex.getMessage());
            errors.add(seriesId + ": " + ex.getMessage());
            return 0;
        }
    }

    private MacroIndicatorRepository.Row toRow(String seriesId, FredObservationsResponse.Observation o) {
        return new MacroIndicatorRepository.Row(
                LocalDate.parse(o.date()),
                seriesId,
                new BigDecimal(o.value())
        );
    }
}
