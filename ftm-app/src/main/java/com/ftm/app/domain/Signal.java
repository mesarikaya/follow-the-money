package com.ftm.app.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "signals")
@IdClass(SignalId.class)
public class Signal {

    @Id
    @Column(name = "signal_date")
    private LocalDate signalDate;

    @Id
    @Column(name = "category_id", length = 10)
    private String categoryId;

    @Id
    @Column(name = "signal_type", length = 30)
    private String signalType;

    @Column(name = "value", precision = 10, scale = 6)
    private BigDecimal value;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;

    @Column(name = "computed_at", nullable = false)
    private OffsetDateTime computedAt;

    protected Signal() {}

    public Signal(LocalDate signalDate, String categoryId, String signalType,
                  BigDecimal value, String metadata, OffsetDateTime computedAt) {
        this.signalDate = signalDate;
        this.categoryId = categoryId;
        this.signalType = signalType;
        this.value = value;
        this.metadata = metadata;
        this.computedAt = computedAt;
    }

    public LocalDate getSignalDate() { return signalDate; }
    public String getCategoryId() { return categoryId; }
    public String getSignalType() { return signalType; }
    public BigDecimal getValue() { return value; }
    public String getMetadata() { return metadata; }
    public OffsetDateTime getComputedAt() { return computedAt; }
}
