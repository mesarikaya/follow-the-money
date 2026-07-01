package com.ftm.app.alerts.repository;

import static com.ftm.app.jooq.Tables.ALERTS;

import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertStatus;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.Severity;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.impl.DSL;
import org.jooq.impl.SQLDataType;
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
            ALERTS.THEME_ID,
            ALERTS.RULE_ID,
            ALERTS.SEVERITY,
            ALERTS.MESSAGE,
            ALERTS.TRIGGER_SNAPSHOT,
            ALERTS.STATUS)
        .values(
            alert.createdAt(),
            alert.categoryId() != null ? alert.categoryId().name() : null,
            alert.themeId(),
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
      condition = condition.and(ALERTS.CATEGORY_ID.isNull()).and(ALERTS.THEME_ID.isNull());
    }
    return dsl.fetchExists(ALERTS, condition);
  }

  public boolean existsActiveAlertForTheme(String ruleId, String themeId) {
    return dsl.fetchExists(
        ALERTS,
        ALERTS
            .RULE_ID
            .eq(ruleId)
            .and(ALERTS.STATUS.eq(AlertStatus.ACTIVE.name()))
            .and(ALERTS.THEME_ID.eq(themeId)));
  }

  public int countActive() {
    return dsl.fetchCount(ALERTS, ALERTS.STATUS.eq(AlertStatus.ACTIVE.name()));
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

  public List<Alert> findRecentByThemeId(String themeId, int limitCount) {
    return dsl.selectFrom(ALERTS)
        .where(ALERTS.THEME_ID.eq(themeId))
        .orderBy(ALERTS.CREATED_AT.desc())
        .limit(limitCount)
        .fetch()
        .map(this::mapRecord);
  }

  public Optional<Alert> acknowledgeAlert(Long alertId) {
    return dsl.update(ALERTS)
        .set(ALERTS.STATUS, AlertStatus.ACKNOWLEDGED.name())
        .set(ALERTS.ACKNOWLEDGED_AT, OffsetDateTime.now())
        .where(ALERTS.ID.eq(alertId))
        .and(ALERTS.STATUS.eq(AlertStatus.ACTIVE.name()))
        .returning(ALERTS.fields())
        .fetchOptional()
        .map(this::mapRecord);
  }

  public Optional<Alert> findById(Long alertId) {
    return dsl.selectFrom(ALERTS).where(ALERTS.ID.eq(alertId)).fetchOptional().map(this::mapRecord);
  }

  public int acknowledgeAllActive() {
    return dsl.update(ALERTS)
        .set(ALERTS.STATUS, AlertStatus.ACKNOWLEDGED.name())
        .set(ALERTS.ACKNOWLEDGED_AT, OffsetDateTime.now())
        .where(ALERTS.STATUS.eq(AlertStatus.ACTIVE.name()))
        .execute();
  }

  public int resolveAlertsByRuleAndCategory(String ruleId, String categoryId) {
    var condition = ALERTS.RULE_ID.eq(ruleId).and(ALERTS.STATUS.eq(AlertStatus.ACTIVE.name()));
    if (categoryId != null) {
      condition = condition.and(ALERTS.CATEGORY_ID.eq(categoryId));
    } else {
      condition = condition.and(ALERTS.CATEGORY_ID.isNull()).and(ALERTS.THEME_ID.isNull());
    }
    return dsl.update(ALERTS)
        .set(ALERTS.STATUS, AlertStatus.RESOLVED.name())
        .set(ALERTS.RESOLVED_AT, OffsetDateTime.now())
        .where(condition)
        .execute();
  }

  public int resolveAlertsByRuleAndTheme(String ruleId, String themeId) {
    return dsl.update(ALERTS)
        .set(ALERTS.STATUS, AlertStatus.RESOLVED.name())
        .set(ALERTS.RESOLVED_AT, OffsetDateTime.now())
        .where(
            ALERTS
                .RULE_ID
                .eq(ruleId)
                .and(ALERTS.STATUS.eq(AlertStatus.ACTIVE.name()))
                .and(ALERTS.THEME_ID.eq(themeId)))
        .execute();
  }

  public List<Map<String, Object>> findDailySeverityCountsSince(int days) {
    var dateField = ALERTS.CREATED_AT.cast(SQLDataType.LOCALDATE).as("alert_date");
    var since = OffsetDateTime.now().minusDays(days);
    return dsl.select(dateField, ALERTS.SEVERITY, DSL.count().as("cnt"))
        .from(ALERTS)
        .where(ALERTS.CREATED_AT.ge(since))
        .groupBy(dateField, ALERTS.SEVERITY)
        .orderBy(dateField)
        .fetch(
            r -> {
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("date", r.get("alert_date", LocalDate.class));
              row.put("severity", r.get(ALERTS.SEVERITY));
              row.put("count", r.get("cnt", Integer.class));
              return row;
            });
  }

  public int countRecentByThemeId(String themeId, int days) {
    var since = OffsetDateTime.now().minusDays(days);
    return dsl.fetchCount(ALERTS, ALERTS.THEME_ID.eq(themeId).and(ALERTS.CREATED_AT.ge(since)));
  }

  public int countRecentByCategoryIds(List<String> categoryIds, int days) {
    if (categoryIds.isEmpty()) return 0;
    var since = OffsetDateTime.now().minusDays(days);
    return dsl.fetchCount(
        ALERTS, ALERTS.CATEGORY_ID.in(categoryIds).and(ALERTS.CREATED_AT.ge(since)));
  }

  public Map<String, Integer> findActiveAlertCountsByCategory() {
    var countField = DSL.count();
    return dsl.select(ALERTS.CATEGORY_ID, countField)
        .from(ALERTS)
        .where(ALERTS.STATUS.eq(AlertStatus.ACTIVE.name()))
        .and(ALERTS.CATEGORY_ID.isNotNull())
        .groupBy(ALERTS.CATEGORY_ID)
        .fetchMap(ALERTS.CATEGORY_ID, countField);
  }

  public Map<String, Integer> findFireCountsByRuleSince(int days) {
    var countField = DSL.count();
    OffsetDateTime since = OffsetDateTime.now().minusDays(days);
    return dsl.select(ALERTS.RULE_ID, countField)
        .from(ALERTS)
        .where(ALERTS.CREATED_AT.ge(since))
        .groupBy(ALERTS.RULE_ID)
        .orderBy(countField.desc())
        .fetchMap(ALERTS.RULE_ID, countField);
  }

  private Alert mapRecord(org.jooq.Record record) {
    var r = (com.ftm.app.jooq.tables.records.AlertsRecord) record;
    CategoryId categoryId = null;
    if (r.getCategoryId() != null) {
      try {
        categoryId = CategoryId.valueOf(r.getCategoryId());
      } catch (IllegalArgumentException ignored) {
        // unknown category_id strings (e.g. from future migrations) map to null
      }
    }
    return new Alert(
        r.getId(),
        r.getCreatedAt(),
        categoryId,
        r.getThemeId(),
        r.getRuleId(),
        Severity.valueOf(r.getSeverity()),
        r.getMessage(),
        r.getTriggerSnapshot() != null ? r.getTriggerSnapshot().data() : "{}",
        AlertStatus.valueOf(r.getStatus()),
        r.getResolvedAt(),
        r.getAcknowledgedAt());
  }
}
