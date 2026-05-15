package com.ftm.app.ingestion.repository;

import com.ftm.app.domain.IngestLog;
import com.ftm.app.domain.IngestSource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface IngestLogRepository extends JpaRepository<IngestLog, UUID> {

    @Query("""
            SELECT i FROM IngestLog i
            WHERE i.startedAt = (
                SELECT MAX(i2.startedAt) FROM IngestLog i2
                WHERE i2.source = i.source
            )
            """)
    List<IngestLog> findLatestPerSource();

    Optional<IngestLog> findTopBySourceOrderByStartedAtDesc(IngestSource source);
}
