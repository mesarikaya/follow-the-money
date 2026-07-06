package com.ftm.app.portfolio.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.Mockito.when;

import com.ftm.app.backtest.service.MomentumScoreComputer;
import com.ftm.app.ingestion.repository.RawPriceRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Optional;
import java.util.TreeMap;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LiveMomentumScoreServiceTest {

  @Mock RawPriceRepository rawPriceRepository;
  // Real computer — the momentum maths is pure and independently tested; wiring is what matters here.
  private final MomentumScoreComputer momentumScoreComputer = new MomentumScoreComputer();

  private LiveMomentumScoreService service() {
    return new LiveMomentumScoreService(rawPriceRepository, momentumScoreComputer);
  }

  @Test
  @DisplayName("returns empty when there is no price data")
  void emptyWhenNoPrices() {
    when(rawPriceRepository.findMaxTradeDate()).thenReturn(Optional.empty());
    assertThat(service().computeLatestMomentumByCategoryId()).isEmpty();
  }

  @Test
  @DisplayName("computes 12-1 momentum for the latest date across the buffered history")
  void computesLatestMomentum() {
    LocalDate latest = LocalDate.of(2024, 12, 31);
    // 253 ascending trading days so the 252-lookback / 21-skip window is fully covered on `latest`.
    NavigableMap<LocalDate, Map<String, BigDecimal>> history = new TreeMap<>();
    for (int i = 0; i < 253; i++) {
      LocalDate date = latest.minusDays(252 - i);
      Map<String, BigDecimal> row = new HashMap<>();
      // TECH rises linearly 100→..; BONDS is flat.
      row.put("TECH", BigDecimal.valueOf(100 + i));
      row.put("BONDS", BigDecimal.valueOf(50));
      history.put(date, row);
    }
    when(rawPriceRepository.findMaxTradeDate()).thenReturn(Optional.of(latest));
    when(rawPriceRepository.findAdjCloseHistory(
            latest.minusDays(LiveMomentumScoreService.PRICE_HISTORY_BUFFER_DAYS), latest))
        .thenReturn(history);

    Map<String, BigDecimal> momentum = service().computeLatestMomentumByCategoryId();

    // recent = index 253-1-21 = 231 (price 331), past = index 0 (price 100): 331/100 - 1 = 2.31.
    assertThat(momentum.get("TECH").doubleValue()).isCloseTo(2.31, within(1e-6));
    assertThat(momentum.get("BONDS").doubleValue()).isCloseTo(0.0, within(1e-9));
  }
}
