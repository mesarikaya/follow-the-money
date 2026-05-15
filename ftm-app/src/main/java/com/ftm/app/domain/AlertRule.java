package com.ftm.app.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "alert_rules")
public class AlertRule {

    @Id
    @Column(name = "rule_id", length = 40)
    private String ruleId;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @Column(name = "z_threshold", precision = 4, scale = 2)
    private BigDecimal zThreshold;

    @Column(name = "persistence_days")
    private Integer persistenceDays;

    @Column(name = "composite_threshold", precision = 4, scale = 3)
    private BigDecimal compositeThreshold;

    @Column(name = "severity", nullable = false, length = 10)
    private String severity;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "category_filter", columnDefinition = "jsonb")
    private String categoryFilter;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "config", columnDefinition = "jsonb")
    private String config;

    @Column(name = "last_updated", nullable = false)
    private OffsetDateTime lastUpdated;

    protected AlertRule() {}

    public AlertRule(String ruleId, Boolean enabled, BigDecimal zThreshold, Integer persistenceDays,
                     BigDecimal compositeThreshold, String severity, String categoryFilter,
                     String config, OffsetDateTime lastUpdated) {
        this.ruleId = ruleId;
        this.enabled = enabled;
        this.zThreshold = zThreshold;
        this.persistenceDays = persistenceDays;
        this.compositeThreshold = compositeThreshold;
        this.severity = severity;
        this.categoryFilter = categoryFilter;
        this.config = config;
        this.lastUpdated = lastUpdated;
    }

    public String getRuleId() { return ruleId; }
    public Boolean getEnabled() { return enabled; }
    public BigDecimal getZThreshold() { return zThreshold; }
    public Integer getPersistenceDays() { return persistenceDays; }
    public BigDecimal getCompositeThreshold() { return compositeThreshold; }
    public String getSeverity() { return severity; }
    public String getCategoryFilter() { return categoryFilter; }
    public String getConfig() { return config; }
    public OffsetDateTime getLastUpdated() { return lastUpdated; }
}
