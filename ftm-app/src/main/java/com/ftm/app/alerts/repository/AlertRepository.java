package com.ftm.app.alerts.repository;

import static com.ftm.app.jooq.Tables.ALERTS;

import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertStatus;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.Severity;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Repository;

@Repository
public class AlertRepository {

  private final DSLContext dsl;

  public AlertRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  public void insert(Alert alert) {
    dsl.insertInto(
            ALERTS,
            ALERTS.CREATED_AT,
            ALERTS.CATEGORY_ID,
            ALERTS.RULE_ID,
            ALERTS.SEVERITY,
            ALERTS.MESSAGE,
            ALERTS.TRIGGER_SNAPSHOT,
            ALERTS.STATUS)
        .values(
            alert.createdAt(),
            alert.categoryId() != null ? alert.categoryId().name() : null,
            alert.ruleId(),
            alert.severity().name(),
            alert.message(),
            JSONB.valueOf(alert.triggerSnapshot()),
            alert.status().name())
        .execute();
  }

  public boolean existsActiveAlert(String ruleId, String categoryId) {
    var condition = ALERTS.RULE_ID.eq(ruleId).and(ALERTS.STATUS.eq(AlertStatus.ACTIVE.name()));
    if (categoryId != null) {
      condition = condition.and(ALERTS.CATEGORY_ID.eq(categoryId));
    } else {
      condition = condition.and(ALERTS.CATEGORY_ID.isNull());
    }
    return dsl.fetchExists(ALERTS, condition);
  }

  public List<Alert> findAllActive() {
    return dsl.selectFrom(ALERTS)
        .where(ALERTS.STATUS.eq(AlertStatus.ACTIVE.name()))
        .orderBy(ALERTS.CREATED_AT.desc())
        .fetch()
        .map(this::mapRecord);
  }

  public List<Alert> findRecentAlerts(int limitCount) {
    return dsl.selectFrom(ALERTS)
        .orderBy(ALERTS.CREATED_AT.desc())
        .limit(limitCount)
        .fetch()
        .map(this::mapRecord);
  }

  public int acknowledgeAlert(Long alertId) {
    return dsl.update(ALERTS)
        .set(ALERTS.STATUS, AlertStatus.ACKNOWLEDGED.name())
        .set(ALERTS.ACKNOWLEDGED_AT, OffsetDateTime.now())
        .where(ALERTS.ID.eq(alertId))
        .and(ALERTS.STATUS.eq(AlertStatus.ACTIVE.name()))
        .execute();
  }

  public Optional<Alert> findById(Long alertId) {
    return dsl.selectFrom(ALERTS).where(ALERTS.ID.eq(alertId)).fetchOptional().map(this::mapRecord);
  }

  public int resolveAlertsByRuleAndCategory(String ruleId, String categoryId) {
    var condition = ALERTS.RULE_ID.eq(ruleId).and(ALERTS.STATUS.eq(AlertStatus.ACTIVE.name()));
    if (categoryId != null) {
      condition = condition.and(ALERTS.CATEGORY_ID.eq(categoryId));
    } else {
      condition = condition.and(ALERTS.CATEGORY_ID.isNull());
    }
    return dsl.update(ALERTS)
        .set(ALERTS.STATUS, AlertStatus.RESOLVED.name())
        .set(ALERTS.RESOLVED_AT, OffsetDateTime.now())
        .where(condition)
        .execute();
  }

  private Alert mapRecord(org.jooq.Record record) {
    var r = (com.ftm.app.jooq.tables.records.AlertsRecord) record;
    return new Alert(
        r.getId(),
        r.getCreatedAt(),
        r.getCategoryId() != null ? CategoryId.valueOf(r.getCategoryId()) : null,
        r.getRuleId(),
        Severity.valueOf(r.getSeverity()),
        r.getMessage(),
        r.getTriggerSnapshot() != null ? r.getTriggerSnapshot().data() : "{}",
        AlertStatus.valueOf(r.getStatus()),
        r.getResolvedAt(),
        r.getAcknowledgedAt());
  }
}
