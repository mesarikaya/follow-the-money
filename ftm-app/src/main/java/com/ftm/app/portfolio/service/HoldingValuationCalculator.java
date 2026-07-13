package com.ftm.app.portfolio.service;

import com.ftm.app.api.dto.HoldingDto;
import com.ftm.app.domain.Holding;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Values a holding in USD and EUR. The only subtlety is GBX: Yahoo quotes London tickers in pence,
 * so a GBX price is divided by 100 and then treated as GBP for the conversion.
 */
@Component
public class HoldingValuationCalculator {

  private static final BigDecimal PENCE_PER_POUND = BigDecimal.valueOf(100);
  private static final int PRICE_SCALE = 6;
  private static final int MONEY_SCALE = 2;

  private static final String GBX = "GBX";
  private static final String GBP = "GBP";
  private static final String EUR = "EUR";
  private static final String SEK = "SEK";
  private static final String USD = "USD";

  public HoldingDto toDto(Holding holding, ExchangeRates rates) {
    String currency = holding.currency() == null ? "" : holding.currency().toUpperCase();
    BigDecimal price = priceOf(holding);

    boolean isPence = GBX.equals(currency);
    BigDecimal localPrice = isPence ? toPounds(price) : price;
    String localCurrency = isPence ? GBP : currency;

    return new HoldingDto(
        holding.ticker(),
        holding.name(),
        holding.categoryId(),
        holding.currency(),
        holding.quantity(),
        holding.avgCostLocal(),
        holding.usdFxRate(),
        marketValueUsd(holding, localPrice, localCurrency, rates),
        holding.currentPriceLocal(),
        holding.priceDate(),
        holding.priceSource(),
        marketValueEur(holding, localPrice, localCurrency, rates));
  }

  /** The live price when we have one, otherwise what the holding cost. */
  private static BigDecimal priceOf(Holding holding) {
    return holding.currentPriceLocal() != null ? holding.currentPriceLocal() : holding.avgCostLocal();
  }

  private static BigDecimal toPounds(BigDecimal pence) {
    return pence == null ? null : pence.divide(PENCE_PER_POUND, PRICE_SCALE, RoundingMode.HALF_UP);
  }

  /** A holding's own stored rate wins; otherwise the rate for its currency. */
  private static BigDecimal usdRateFor(Holding holding, String currency, ExchangeRates rates) {
    if (holding.usdFxRate() != null) return holding.usdFxRate();
    if (GBP.equals(currency)) return rates.gbpToUsd();
    if (SEK.equals(currency)) return rates.sekToUsd();
    return rates.usdPerEur();
  }

  private static BigDecimal marketValueUsd(
      Holding holding, BigDecimal localPrice, String currency, ExchangeRates rates) {
    BigDecimal localValue = localValue(holding, localPrice);
    if (localValue == null) return null;
    if (USD.equals(currency)) return localValue.setScale(MONEY_SCALE, RoundingMode.HALF_UP);

    BigDecimal usdRate = usdRateFor(holding, currency, rates);
    if (usdRate == null) return null;
    return localValue.multiply(usdRate).setScale(MONEY_SCALE, RoundingMode.HALF_UP);
  }

  private static BigDecimal marketValueEur(
      Holding holding, BigDecimal localPrice, String currency, ExchangeRates rates) {
    BigDecimal localValue = localValue(holding, localPrice);
    if (localValue == null) return null;
    if (EUR.equals(currency)) return localValue.setScale(MONEY_SCALE, RoundingMode.HALF_UP);

    BigDecimal usdPerEur = rates.usdPerEur();
    if (usdPerEur == null) return null;
    if (USD.equals(currency)) return toEur(localValue, usdPerEur);

    BigDecimal usdRate =
        GBP.equals(currency) ? rates.gbpToUsd() : SEK.equals(currency) ? rates.sekToUsd() : null;
    if (usdRate == null) return null;
    return toEur(localValue.multiply(usdRate), usdPerEur);
  }

  private static BigDecimal toEur(BigDecimal usdValue, BigDecimal usdPerEur) {
    return usdValue.divide(usdPerEur, MONEY_SCALE, RoundingMode.HALF_UP);
  }

  private static BigDecimal localValue(Holding holding, BigDecimal localPrice) {
    if (localPrice == null || holding.quantity() == null) return null;
    return holding.quantity().multiply(localPrice);
  }

  public BigDecimal totalMarketValueUsd(List<HoldingDto> holdings) {
    return total(holdings, HoldingDto::marketValueUsd);
  }

  public BigDecimal totalMarketValueEur(List<HoldingDto> holdings) {
    return total(holdings, HoldingDto::marketValueEur);
  }

  private static BigDecimal total(
      List<HoldingDto> holdings, java.util.function.Function<HoldingDto, BigDecimal> value) {
    return holdings.stream()
        .map(holding -> value.apply(holding) != null ? value.apply(holding) : BigDecimal.ZERO)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }
}
