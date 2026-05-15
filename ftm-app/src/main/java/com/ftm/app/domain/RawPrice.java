package com.ftm.app.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "raw_prices")
@IdClass(RawPriceId.class)
public class RawPrice {

    @Id
    @Column(name = "trade_date")
    private LocalDate tradeDate;

    @Id
    @Column(name = "category_id", length = 10)
    private String categoryId;

    @Column(name = "open", nullable = false, precision = 12, scale = 4)
    private BigDecimal open;

    @Column(name = "high", nullable = false, precision = 12, scale = 4)
    private BigDecimal high;

    @Column(name = "low", nullable = false, precision = 12, scale = 4)
    private BigDecimal low;

    @Column(name = "close", nullable = false, precision = 12, scale = 4)
    private BigDecimal close;

    @Column(name = "adj_close", nullable = false, precision = 12, scale = 4)
    private BigDecimal adjClose;

    @Column(name = "volume", nullable = false)
    private Long volume;

    @Column(name = "aum_usd", precision = 18, scale = 2)
    private BigDecimal aumUsd;

    @Column(name = "estimated_flow", precision = 18, scale = 2)
    private BigDecimal estimatedFlow;

    protected RawPrice() {}

    public RawPrice(LocalDate tradeDate, String categoryId, BigDecimal open, BigDecimal high,
                    BigDecimal low, BigDecimal close, BigDecimal adjClose, Long volume,
                    BigDecimal aumUsd, BigDecimal estimatedFlow) {
        this.tradeDate = tradeDate;
        this.categoryId = categoryId;
        this.open = open;
        this.high = high;
        this.low = low;
        this.close = close;
        this.adjClose = adjClose;
        this.volume = volume;
        this.aumUsd = aumUsd;
        this.estimatedFlow = estimatedFlow;
    }

    public LocalDate getTradeDate() { return tradeDate; }
    public String getCategoryId() { return categoryId; }
    public BigDecimal getOpen() { return open; }
    public BigDecimal getHigh() { return high; }
    public BigDecimal getLow() { return low; }
    public BigDecimal getClose() { return close; }
    public BigDecimal getAdjClose() { return adjClose; }
    public Long getVolume() { return volume; }
    public BigDecimal getAumUsd() { return aumUsd; }
    public BigDecimal getEstimatedFlow() { return estimatedFlow; }
}
