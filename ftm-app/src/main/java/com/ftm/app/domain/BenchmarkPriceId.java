package com.ftm.app.domain;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;

public class BenchmarkPriceId implements Serializable {

    private LocalDate tradeDate;
    private String ticker;

    public BenchmarkPriceId() {}

    public BenchmarkPriceId(LocalDate tradeDate, String ticker) {
        this.tradeDate = tradeDate;
        this.ticker = ticker;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof BenchmarkPriceId that)) return false;
        return Objects.equals(tradeDate, that.tradeDate) && Objects.equals(ticker, that.ticker);
    }

    @Override
    public int hashCode() { return Objects.hash(tradeDate, ticker); }
}
