package com.ftm.app.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "rotation_events")
public class RotationEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "detected_date", nullable = false)
    private LocalDate detectedDate;

    @Column(name = "category_id", nullable = false, length = 10)
    private String categoryId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 30)
    private RotationEventType eventType;

    @DecimalMin("0.000")
    @DecimalMax("1.000")
    @Column(name = "confidence", nullable = false, precision = 4, scale = 3)
    private BigDecimal confidence;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "signal_snapshot", nullable = false, columnDefinition = "jsonb")
    private String signalSnapshot;

    @Column(name = "notes")
    private String notes;

    protected RotationEvent() {}

    public RotationEvent(LocalDate detectedDate, String categoryId, RotationEventType eventType,
                         BigDecimal confidence, String signalSnapshot, String notes) {
        this.detectedDate = detectedDate;
        this.categoryId = categoryId;
        this.eventType = eventType;
        this.confidence = confidence;
        this.signalSnapshot = signalSnapshot;
        this.notes = notes;
    }

    public Long getId() { return id; }
    public LocalDate getDetectedDate() { return detectedDate; }
    public String getCategoryId() { return categoryId; }
    public RotationEventType getEventType() { return eventType; }
    public BigDecimal getConfidence() { return confidence; }
    public String getSignalSnapshot() { return signalSnapshot; }
    public String getNotes() { return notes; }
}
