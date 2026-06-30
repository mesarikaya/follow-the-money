package com.ftm.app.portfolio.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.ftm.app.domain.Holding;
import com.ftm.app.portfolio.repository.HoldingRepository;
import com.ftm.app.portfolio.repository.TickerMappingRepository;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * Reproduces the "Adyen shows Unclassified" report: a holding persisted with a null category_id
 * (uploaded before its mapping existed) should be backfilled once the mapping is present. The test
 * seeds its own mapping and refreshes the classification cache so it does not depend on (or mutate)
 * the shared seed data other tests may truncate.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class HoldingClassificationBackfillIT {

  private static final String ADYEN = "ADYEN.AS";
  private static final String FINTECH = "FINL_FINT";

  @Autowired HoldingRepository holdingRepository;
  @Autowired TickerMappingRepository tickerMappingRepository;
  @Autowired HoldingClassificationService classificationService;
  @Autowired HoldingUploadService holdingUploadService;

  @Autowired JdbcTemplate jdbcTemplate;

  @BeforeEach
  void setUp() {
    jdbcTemplate.execute("TRUNCATE holdings CASCADE");
    tickerMappingRepository.upsert(ADYEN, FINTECH, "test seed — Adyen N.V. (Euronext Amsterdam)");
    classificationService.refreshCache();
  }

  private Holding unclassified(String ticker) {
    return new Holding(
        null,
        ticker,
        ticker + " N.V.",
        null, // category_id intentionally null — the bug condition
        "EUR",
        new BigDecimal("2.0"),
        new BigDecimal("816.00"),
        null,
        null,
        null,
        null,
        null);
  }

  @Test
  @DisplayName("ADYEN.AS persisted with null category is backfilled to its mapped category")
  void reclassifiesAdyenFromMapping() {
    holdingRepository.replaceAll(List.of(unclassified(ADYEN)));
    assertThat(holdingRepository.findAll().get(0).categoryId()).isNull();

    int reclassified = holdingUploadService.reclassifyUnmappedHoldings();

    assertThat(reclassified).isEqualTo(1);
    assertThat(holdingRepository.findAll().get(0).categoryId()).isEqualTo(FINTECH);
  }

  @Test
  @DisplayName("a holding whose ticker has no mapping stays unclassified and is not counted")
  void leavesGenuinelyUnmappedHoldingsAlone() {
    holdingRepository.replaceAll(List.of(unclassified("ZZZZ.XX")));

    int reclassified = holdingUploadService.reclassifyUnmappedHoldings();

    assertThat(reclassified).isZero();
    assertThat(holdingRepository.findAll().get(0).categoryId()).isNull();
  }
}
