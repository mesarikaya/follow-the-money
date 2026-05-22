package com.ftm.app.ingestion.service;

import com.ftm.app.domain.IngestLog;
import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import com.ftm.app.ingestion.repository.IngestLogRepository;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IngestLogService {

  private static final Logger log = LoggerFactory.getLogger(IngestLogService.class);

  private final IngestLogRepository repository;

  public IngestLogService(IngestLogRepository repository) {
    this.repository = repository;
  }

  @Transactional(readOnly = true)
  public Optional<IngestLog> findRunningLog(IngestSource source) {
    return repository
        .findTopBySourceOrderByStartedAtDesc(source)
        .filter(l -> l.status() == IngestStatus.RUNNING);
  }

  @Transactional
  public void finish(IngestLog ingestLog, IngestStatus status, int rows, String errorsJson) {
    log.info(
        "Finishing run {} source={} status={} rows={}",
        ingestLog.runId(),
        ingestLog.source(),
        status,
        rows);
    repository.update(ingestLog.finish(OffsetDateTime.now(), status, rows, errorsJson));
  }
}
