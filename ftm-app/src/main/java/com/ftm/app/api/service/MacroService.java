package com.ftm.app.api.service;

import com.ftm.app.api.dto.MacroIndicatorsDto;
import com.ftm.app.api.dto.MacroRegimeHistoryEntry;
import com.ftm.app.api.dto.MacroResponse;
import com.ftm.app.api.repository.MacroIndicatorReadRepository;
import com.ftm.app.domain.MacroIndicator;
import com.ftm.app.signals.domain.MacroRegime;
import com.ftm.app.signals.service.MacroRegimeService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class MacroService {

    private static final Logger log = LoggerFactory.getLogger(MacroService.class);

    private final MacroIndicatorReadRepository macroIndicatorRepository;
    private final MacroRegimeService macroRegimeService;

    public MacroService(MacroIndicatorReadRepository macroIndicatorRepository,
                        MacroRegimeService macroRegimeService) {
        this.macroIndicatorRepository = macroIndicatorRepository;
        this.macroRegimeService = macroRegimeService;
    }

    @Cacheable("macro-latest")
    public MacroResponse getMacroResponse() {
        log.debug("Loading latest macro indicators");
        List<MacroIndicator> indicators = macroIndicatorRepository.findLatestPerSeries();

        Map<String, BigDecimal> latestBySeriesId = indicators.stream()
                .collect(Collectors.toMap(MacroIndicator::seriesId, MacroIndicator::value));

        LocalDate asOfDate = indicators.stream()
                .map(MacroIndicator::observationDate)
                .max(LocalDate::compareTo)
                .orElse(LocalDate.now());

        MacroIndicatorsDto indicatorsDto = new MacroIndicatorsDto(
                latestBySeriesId.get("T10Y2Y"),
                latestBySeriesId.get("VIXCLS"),
                latestBySeriesId.get("DTWEXBGS"),
                latestBySeriesId.get("T10YIE"),
                latestBySeriesId.get("FEDFUNDS"),
                latestBySeriesId.get("DGS10"),
                latestBySeriesId.get("DGS2"),
                latestBySeriesId.get("DCOILWTICO")
        );

        MacroRegime currentRegime = macroRegimeService.classifyCurrentRegime();
        List<MacroRegimeHistoryEntry> regimeHistory = List.of(
                new MacroRegimeHistoryEntry(asOfDate, currentRegime.name())
        );

        return new MacroResponse(asOfDate, currentRegime.name(), indicatorsDto, regimeHistory);
    }
}
