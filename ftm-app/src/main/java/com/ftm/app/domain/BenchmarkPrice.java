package com.ftm.app.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "benchmark_prices")
@IdClass(BenchmarkPriceId.class)
public class BenchmarkPrice {

    @Id
    @Column(name = "trade_date")
    private LocalDate tradeDate;

    @Id
    @Column(name = "ticker", length = 10)
    private String ticker;

    @Column(name = "adj_close", nullable = false, precision = 12, scale = 4)
    private BigDecimal adjClose;

    protected BenchmarkPrice() {}

    public BenchmarkPrice(LocalDate tradeDate, String ticker, BigDecimal adjClose) {
        this.tradeDate = tradeDate;
        this.ticker = ticker;
        this.adjClose = adjClose;
    }

    public LocalDate getTradeDate() { return tradeDate; }
    public String getTicker() { return ticker; }
    public BigDecimal getAdjClose() { return adjClose; }
}
