package com.ftm.app.themes.coverage;

import com.ftm.app.api.dto.HoldingDto;
import com.ftm.app.api.dto.ThemePortfolioCoverageDto;
import com.ftm.app.themes.service.ThemeService;
import com.ftm.app.portfolio.service.HoldingUploadService;
import com.ftm.app.themes.repository.ThemeRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class ThemePortfolioCoverageService {

  private final ThemeService themeService;
  private final ThemeRepository themeRepository;
  private final HoldingUploadService holdingUploadService;
  private final ThemePortfolioCoverageAnalyzer analyzer;

  public ThemePortfolioCoverageService(
      ThemeService themeService,
      ThemeRepository themeRepository,
      HoldingUploadService holdingUploadService,
      ThemePortfolioCoverageAnalyzer analyzer) {
    this.themeService = themeService;
    this.themeRepository = themeRepository;
    this.holdingUploadService = holdingUploadService;
    this.analyzer = analyzer;
  }

  public List<ThemePortfolioCoverageDto> getCoverage() {
    List<HoldingDto> holdings = holdingUploadService.getHoldings();
    BigDecimal totalEur =
        holdings.stream()
            .map(HoldingDto::marketValueEur)
            .filter(Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

    return analyzer.analyze(
        themeService.getThemes(),
        themeRepository.findAllConstituentsByTheme(),
        holdings,
        totalEur);
  }
}
