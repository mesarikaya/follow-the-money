package com.ftm.app.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "categories")
public class Category {

    @Id
    @Column(name = "id", length = 10)
    private String id;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private CategoryType type;

    @Column(name = "etf_ticker", nullable = false, length = 10)
    private String etfTicker;

    @Column(name = "benchmark_ticker", nullable = false, length = 10)
    private String benchmarkTicker;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "active", nullable = false)
    private Boolean active;

    protected Category() {}

    public Category(String id, String name, CategoryType type, String etfTicker,
                    String benchmarkTicker, Integer displayOrder, Boolean active) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.etfTicker = etfTicker;
        this.benchmarkTicker = benchmarkTicker;
        this.displayOrder = displayOrder;
        this.active = active;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public CategoryType getType() { return type; }
    public String getEtfTicker() { return etfTicker; }
    public String getBenchmarkTicker() { return benchmarkTicker; }
    public Integer getDisplayOrder() { return displayOrder; }
    public Boolean getActive() { return active; }
}
