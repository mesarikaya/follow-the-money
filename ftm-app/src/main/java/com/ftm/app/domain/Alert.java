package com.ftm.app.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "alerts")
public class Alert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "category_id", length = 10)
    private String categoryId;

    @Column(name = "rule_id", nullable = false, length = 40)
    private String ruleId;

    @Enumerated(EnumType.STRING)
    @Column(name = "severity", nullable = false, length = 10)
    private Severity severity;

    @Column(name = "message", nullable = false)
    private String message;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "trigger_snapshot", nullable = false, columnDefinition = "jsonb")
    private String triggerSnapshot;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 10)
    private AlertStatus status;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    @Column(name = "acknowledged_at")
    private OffsetDateTime acknowledgedAt;

    protected Alert() {}

    public Alert(OffsetDateTime createdAt, String categoryId, String ruleId, Severity severity,
                 String message, String triggerSnapshot, AlertStatus status) {
        this.createdAt = createdAt;
        this.categoryId = categoryId;
        this.ruleId = ruleId;
        this.severity = severity;
        this.message = message;
        this.triggerSnapshot = triggerSnapshot;
        this.status = status;
    }

    public Long getId() { return id; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public String getCategoryId() { return categoryId; }
    public String getRuleId() { return ruleId; }
    public Severity getSeverity() { return severity; }
    public String getMessage() { return message; }
    public String getTriggerSnapshot() { return triggerSnapshot; }
    public AlertStatus getStatus() { return status; }
    public OffsetDateTime getResolvedAt() { return resolvedAt; }
    public OffsetDateTime getAcknowledgedAt() { return acknowledgedAt; }
}
