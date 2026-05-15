package com.ftm.app.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "macro_indicators")
@IdClass(MacroIndicatorId.class)
public class MacroIndicator {

    @Id
    @Column(name = "observation_date")
    private LocalDate observationDate;

    @Id
    @Column(name = "series_id", length = 20)
    private String seriesId;

    @Column(name = "value", precision = 10, scale = 4)
    private BigDecimal value;

    @Column(name = "source", nullable = false, length = 10)
    private String source;

    protected MacroIndicator() {}

    public MacroIndicator(LocalDate observationDate, String seriesId, BigDecimal value, String source) {
        this.observationDate = observationDate;
        this.seriesId = seriesId;
        this.value = value;
        this.source = source;
    }

    public LocalDate getObservationDate() { return observationDate; }
    public String getSeriesId() { return seriesId; }
    public BigDecimal getValue() { return value; }
    public String getSource() { return source; }
}
