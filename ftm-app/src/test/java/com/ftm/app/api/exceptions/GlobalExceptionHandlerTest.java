package com.ftm.app.api.exceptions;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.NoSuchElementException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.ProblemDetail;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.resource.NoResourceFoundException;

class GlobalExceptionHandlerTest {

  private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

  @Test
  @DisplayName("unmatched request path yields 404, not 500")
  void unmatchedPathIsNotFound() {
    var ex =
        new NoResourceFoundException(HttpMethod.GET, "/api/does-not-exist", "/api/does-not-exist");

    ProblemDetail problem = handler.handleNoResourceFound(ex, request("/api/does-not-exist"));

    assertThat(problem.getStatus()).isEqualTo(404);
    assertThat(problem.getTitle()).isEqualTo(GlobalExceptionHandler.RESOURCE_NOT_FOUND);
    assertThat(problem.getType())
        .hasToString(GlobalExceptionHandler.HTTPS_FTM_LOCAL_ERRORS_NOT_FOUND);
    assertThat(problem.getInstance()).hasToString("/api/does-not-exist");
  }

  @Test
  @DisplayName("NoSuchElementException maps to 404 with its message")
  void missingEntityIsNotFound() {
    ProblemDetail problem =
        handler.handleNotFound(
            new NoSuchElementException("category 99 not found"), request("/categories/99"));

    assertThat(problem.getStatus()).isEqualTo(404);
    assertThat(problem.getDetail()).isEqualTo("category 99 not found");
    assertThat(problem.getType())
        .hasToString(GlobalExceptionHandler.HTTPS_FTM_LOCAL_ERRORS_NOT_FOUND);
  }

  @Test
  @DisplayName("IllegalArgumentException maps to 422 validation problem")
  void illegalArgumentIsUnprocessable() {
    ProblemDetail problem =
        handler.handleIllegalArgument(
            new IllegalArgumentException("bad input"), request("/backtest/run"));

    assertThat(problem.getStatus()).isEqualTo(422);
    assertThat(problem.getDetail()).isEqualTo("bad input");
    assertThat(problem.getTitle()).isEqualTo(GlobalExceptionHandler.VALIDATION_FAILED);
  }

  @Test
  @DisplayName("unexpected exception maps to 500 without leaking the message")
  void genericExceptionIsInternalError() {
    ProblemDetail problem =
        handler.handleGeneric(
            new RuntimeException("connection reset by peer"), request("/portfolio"));

    assertThat(problem.getStatus()).isEqualTo(500);
    assertThat(problem.getDetail()).isEqualTo("An unexpected error occurred");
    assertThat(problem.getDetail()).doesNotContain("connection reset");
  }

  private WebRequest request(String uri) {
    return new ServletWebRequest(new MockHttpServletRequest("GET", uri));
  }
}
