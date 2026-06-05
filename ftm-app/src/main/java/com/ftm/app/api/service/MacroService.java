package com.ftm.app.api.service;

import com.ftm.app.api.dto.MacroIndicatorsDto;
import com.ftm.app.api.dto.MacroRegimeHistoryEntry;
import com.ftm.app.api.dto.MacroResponse;
import com.ftm.app.api.dto.MacroSeriesPoint;
import com.ftm.app.api.repository.MacroIndicatorReadRepository;
import com.ftm.app.domain.MacroIndicator;
import com.ftm.app.signals.domain.MacroRegime;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.signals.service.MacroRegimeService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class MacroService {

  private static final Logger log = LoggerFactory.getLogger(MacroService.class);
  private static final int REGIME_HISTORY_LOOKBACK_DAYS = 91;

  private final MacroIndicatorReadRepository macroIndicatorRepository;
  private final MacroRegimeService macroRegimeService;
  private final SignalRepository signalRepository;

  public MacroService(
      MacroIndicatorReadRepository macroIndicatorRepository,
      MacroRegimeService macroRegimeService,
      SignalRepository signalRepository) {
    this.macroIndicatorRepository = macroIndicatorRepository;
    this.macroRegimeService = macroRegimeService;
    this.signalRepository = signalRepository;
  }

  @Cacheable("macro-latest")
  public MacroResponse getMacroResponse() {
    log.debug("Loading latest macro indicators");
    List<MacroIndicator> indicators = macroIndicatorRepository.findLatestPerSeries();

    Map<String, BigDecimal> latestBySeriesId =
        indicators.stream()
            .collect(Collectors.toMap(MacroIndicator::seriesId, MacroIndicator::value));

    LocalDate asOfDate =
        indicators.stream()
            .map(MacroIndicator::observationDate)
            .max(LocalDate::compareTo)
            .orElse(LocalDate.now());

    MacroIndicatorsDto indicatorsDto = buildIndicatorsDto(latestBySeriesId);

    List<MacroIndicator> previousIndicatorList =
        macroIndicatorRepository.findPreviousPerSeries(asOfDate);
    Map<String, BigDecimal> prevBySeriesId =
        previousIndicatorList.stream()
            .collect(Collectors.toMap(MacroIndicator::seriesId, MacroIndicator::value));
    MacroIndicatorsDto previousIndicatorsDto = buildIndicatorsDto(prevBySeriesId);

    MacroRegime currentRegime = macroRegimeService.classifyCurrentRegime();

    List<MacroRegimeHistoryEntry> regimeHistory =
        signalRepository.findMacroRegimeHistory(REGIME_HISTORY_LOOKBACK_DAYS).stream()
            .map(
                row ->
                    new MacroRegimeHistoryEntry(
                        row.date(), ordinalToRegimeName(row.regimeOrdinal().intValue())))
            .toList();

    if (regimeHistory.isEmpty()) {
      regimeHistory = List.of(new MacroRegimeHistoryEntry(asOfDate, currentRegime.name()));
    }

    Map<String, BigDecimal> macroFitByCategory =
        macroRegimeService.computeMacroFitByCategory(currentRegime);

    return new MacroResponse(
        asOfDate,
        currentRegime.name(),
        indicatorsDto,
        previousIndicatorsDto,
        regimeHistory,
        macroFitByCategory);
  }

  private static final List<String> ALL_SERIES =
      List.of("T10Y2Y", "VIXCLS", "DTWEXBGS", "T10YIE", "FEDFUNDS", "DGS10", "DGS2", "DCOILWTICO");

  @Cacheable("macro-history")
  public Map<String, List<MacroSeriesPoint>> getMacroHistory(int days) {
    LocalDate from = LocalDate.now().minusDays(days);
    List<MacroIndicator> raw = macroIndicatorRepository.findHistoricalForSeries(ALL_SERIES, from);
    Map<String, List<MacroSeriesPoint>> result = new LinkedHashMap<>();
    for (String series : ALL_SERIES) {
      result.put(series, new ArrayList<>());
    }
    for (MacroIndicator mi : raw) {
      if (mi.value() != null) {
        result.computeIfAbsent(mi.seriesId(), k -> new ArrayList<>())
            .add(new MacroSeriesPoint(mi.observationDate(), mi.value()));
      }
    }
    return result;
  }

  private static MacroIndicatorsDto buildIndicatorsDto(Map<String, BigDecimal> bySeriesId) {
    return new MacroIndicatorsDto(
        bySeriesId.get("T10Y2Y"),
        bySeriesId.get("VIXCLS"),
        bySeriesId.get("DTWEXBGS"),
        bySeriesId.get("T10YIE"),
        bySeriesId.get("FEDFUNDS"),
        bySeriesId.get("DGS10"),
        bySeriesId.get("DGS2"),
        bySeriesId.get("DCOILWTICO"));
  }

  private static String ordinalToRegimeName(int ordinal) {
    return switch (ordinal) {
      case 0 -> MacroRegime.STAGFLATION.name();
      case 1 -> MacroRegime.RISK_OFF_FLIGHT.name();
      case 2 -> MacroRegime.RISK_ON_GROWTH.name();
      case 3 -> MacroRegime.RISK_ON_DEFENSIVE.name();
      default -> "UNKNOWN";
    };
  }
}
