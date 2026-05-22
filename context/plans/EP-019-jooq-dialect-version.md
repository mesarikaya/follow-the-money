# Plan: EP-019 — Fix jOOQ Dialect Version Mismatch Warning

## Problem

At startup, jOOQ logs:

```
o.j.i.D.logVersionSupport : Version mismatch : Database version is older than what
dialect SQLDialect.POSTGRES supports: 16.14 (Debian 16.14-1.pgdg13+1).
Consider https://www.jooq.org/download/support-matrix
```

**Root cause:** Spring Boot 4.1.0-M4 bundles jOOQ 3.19.x, which targets PostgreSQL 17 as
its primary certified version. The Docker image `postgres:16` resolves to PG 16.14.
jOOQ detects the minor-version gap and logs a warning at every startup.

The warning is harmless — PG 16 and PG 17 differ only in features not used here (logical
replication improvements, MERGE refinements). All SQL in this project runs correctly on
PG 16. But the warning is noise and signals a real drift between the runtime DB and the
jOOQ build target.

---

## Options

### Option A — Upgrade PostgreSQL to 17 (Recommended)

**Change:** `docker-compose.yml` line 3: `postgres:16` → `postgres:17`

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:17        # was postgres:16
```

**Why this is the right fix:**
- Eliminates the root mismatch, not just the warning
- PG 17 is the current stable release (GA since October 2024)
- No SQL compatibility issues — PG 16→17 has no breaking DDL/DML changes
- All Flyway migrations (`V1–V9`) use standard SQL; none use PG16-specific syntax

**Migration steps:**

1. Back up data (local dev — a dump is sufficient):
   ```bash
   docker exec ftm-postgres-1 pg_dump -U ftm ftm > ftm-backup-pg16.sql
   ```
2. Stop the container and remove the old volume (PG can't upgrade in place):
   ```bash
   docker compose down
   docker volume rm follow-the-money_postgres_data
   ```
3. Change `postgres:16` → `postgres:17` in `docker-compose.yml`
4. Start fresh:
   ```bash
   docker compose up -d
   ```
5. Flyway runs all migrations automatically on next app boot — no manual restore needed
   (the DB is seeded from migrations, not from dumped data).

**Verification:** Startup log should no longer contain `logVersionSupport`. Confirm with:
```bash
grep -i "version mismatch\|logVersionSupport" app.log
```

---

### Option B — Suppress the warning (not recommended)

jOOQ respects the standard SLF4J/Logback configuration. The logger name is
`org.jooq.impl.DefaultConfiguration` (abbreviated `o.j.i.D` in the log).

```yaml
# application.yml
logging:
  level:
    org.jooq.impl.DefaultConfiguration: ERROR   # suppresses WARN level
```

**Downsides:**
- Hides the symptom, not the cause
- Suppresses ALL warnings from DefaultConfiguration, including future real issues
- Technical debt: the mismatch remains and silently worsens if PG or jOOQ is updated again

---

### Option C — Pin jOOQ to a PG-16-certified version (not recommended)

Would require overriding Spring Boot's managed jOOQ BOM version. Spring Boot 4.1 is a
milestone release; pinning against its BOM is fragile and blocks future Boot upgrades.
Not worth it when Option A is a one-liner.

---

## Decision

**Execute Option A.** Single-line change to `docker-compose.yml`. Zero code changes in
`ftm-app`. Flyway handles schema replay automatically. Estimated time: 5 minutes
(excluding pg_dump if local data must be preserved).

---

## Epic details

| Field        | Value                                    |
|--------------|------------------------------------------|
| Epic ID      | EP-019                                   |
| Branch       | `fix/EP-019-postgres-17`                 |
| Files changed | `docker-compose.yml` (1 line)           |
| Tests        | All existing tests still pass (no code change) |
| Risk         | Very low — standard PG major upgrade, all SQL is compatible |
