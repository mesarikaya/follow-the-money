package com.ftm.app.portfolio.service;

import java.math.BigDecimal;

/**
 * The FX rates needed to value a portfolio, all quoted against USD except the euro rate, which is
 * USD per EUR. Any of them may be null when the provider has nothing for that pair.
 */
public record ExchangeRates(BigDecimal usdPerEur, BigDecimal gbpToUsd, BigDecimal sekToUsd) {

  public static ExchangeRates fetchFrom(HoldingPriceService holdingPriceService) {
    return new ExchangeRates(
        holdingPriceService.fetchUsdPerEurRate(),
        holdingPriceService.fetchGbpUsdRate(),
        holdingPriceService.fetchSekUsdRate());
  }
}
