package com.ftm.app;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class FtmApplicationTests {

  @Test
  void contextLoads() {
    // Validates: Spring context starts, Flyway runs, JPA validates schema, Caffeine wires up.
    // Uses Testcontainers (jdbc:tc:postgresql:16:///ftm) — no local PostgreSQL needed.
  }
}
