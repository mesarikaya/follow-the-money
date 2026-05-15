package com.ftm.app.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.DecimalMin;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "portfolio")
public class Portfolio {

    @Id
    @Column(name = "category_id", length = 10)
    private String categoryId;

    @DecimalMin("0.00")
    @Column(name = "allocation_pct", nullable = false, precision = 5, scale = 2)
    private BigDecimal allocationPct;

    @Column(name = "last_updated", nullable = false)
    private OffsetDateTime lastUpdated;

    @Column(name = "notes")
    private String notes;

    protected Portfolio() {}

    public Portfolio(String categoryId, BigDecimal allocationPct, OffsetDateTime lastUpdated, String notes) {
        this.categoryId = categoryId;
        this.allocationPct = allocationPct;
        this.lastUpdated = lastUpdated;
        this.notes = notes;
    }

    public String getCategoryId() { return categoryId; }
    public BigDecimal getAllocationPct() { return allocationPct; }
    public OffsetDateTime getLastUpdated() { return lastUpdated; }
    public String getNotes() { return notes; }
}
