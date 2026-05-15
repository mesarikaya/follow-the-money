package com.ftm.app.ingestion.service;

import com.ftm.app.domain.IngestLog;
import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import com.ftm.app.ingestion.repository.IngestLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Optional;

@Service
public class IngestLogService {

    private final IngestLogRepository repository;

    public IngestLogService(IngestLogRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Optional<IngestLog> findRunningLog(IngestSource source) {
        return repository.findTopBySourceOrderByStartedAtDesc(source)
                .filter(l -> l.getStatus() == IngestStatus.RUNNING);
    }

    @Transactional
    public void finish(IngestLog log, IngestStatus status, int rows, String errorsJson) {
        log.finish(OffsetDateTime.now(), status, rows, errorsJson);
        repository.save(log);
    }
}
