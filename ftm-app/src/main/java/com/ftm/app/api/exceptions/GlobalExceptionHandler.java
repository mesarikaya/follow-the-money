package com.ftm.app.api.exceptions;

import jakarta.validation.ConstraintViolationException;
import java.net.URI;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

@RestControllerAdvice
public class GlobalExceptionHandler {

  public static final String HTTPS_FTM_LOCAL_ERRORS_VALIDATION =
      "https://ftm.local/errors/validation";
  public static final String VALIDATION_FAILED = "Validation failed";
  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
  private static final HttpStatusCode NOT_FOUND = HttpStatusCode.valueOf(404);
  private static final HttpStatusCode UNPROCESSABLE = HttpStatusCode.valueOf(422);
  private static final HttpStatusCode INTERNAL = HttpStatusCode.valueOf(500);

  @ExceptionHandler(NoSuchElementException.class)
  public ProblemDetail handleNotFound(NoSuchElementException ex, WebRequest request) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(NOT_FOUND, ex.getMessage());
    problem.setType(URI.create("https://ftm.local/errors/not-found"));
    problem.setTitle("Resource not found");
    problem.setInstance(URI.create(request.getDescription(false).replace("uri=", "")));
    return problem;
  }

  // Spring MVC 7 dispatches @RequestParam / @PathVariable violations as
  // HandlerMethodValidationException
  @ExceptionHandler(HandlerMethodValidationException.class)
  public ProblemDetail handleHandlerMethodValidation(
      HandlerMethodValidationException ex, WebRequest request) {
    String detail =
        ex.getAllErrors().stream()
            .map(MessageSourceResolvable::getDefaultMessage)
            .collect(Collectors.joining("; "));
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(UNPROCESSABLE, detail);
    problem.setType(URI.create(HTTPS_FTM_LOCAL_ERRORS_VALIDATION));
    problem.setTitle(VALIDATION_FAILED);
    problem.setInstance(URI.create(request.getDescription(false).replace("uri=", "")));
    return problem;
  }

  // Kept for @RequestBody / @ModelAttribute binding violations
  @ExceptionHandler(ConstraintViolationException.class)
  public ProblemDetail handleConstraintViolation(
      ConstraintViolationException ex, WebRequest request) {
    String detail =
        ex.getConstraintViolations().stream()
            .map(v -> v.getPropertyPath() + ": " + v.getMessage())
            .collect(Collectors.joining("; "));
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(UNPROCESSABLE, detail);
    problem.setType(URI.create(HTTPS_FTM_LOCAL_ERRORS_VALIDATION));
    problem.setTitle(VALIDATION_FAILED);
    problem.setInstance(URI.create(request.getDescription(false).replace("uri=", "")));
    return problem;
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ProblemDetail handleMethodArgumentNotValid(
      MethodArgumentNotValidException ex, WebRequest request) {
    String detail =
        ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .collect(Collectors.joining("; "));
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(UNPROCESSABLE, detail);
    problem.setType(URI.create(HTTPS_FTM_LOCAL_ERRORS_VALIDATION));
    problem.setTitle(VALIDATION_FAILED);
    problem.setInstance(URI.create(request.getDescription(false).replace("uri=", "")));
    return problem;
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ProblemDetail handleIllegalArgument(IllegalArgumentException ex, WebRequest request) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(UNPROCESSABLE, ex.getMessage());
    problem.setType(URI.create(HTTPS_FTM_LOCAL_ERRORS_VALIDATION));
    problem.setTitle(VALIDATION_FAILED);
    problem.setInstance(URI.create(request.getDescription(false).replace("uri=", "")));
    return problem;
  }

  @ExceptionHandler(Exception.class)
  public ProblemDetail handleGeneric(Exception ex, WebRequest request) {
    log.error("Unhandled exception at {}: {}", request.getDescription(false), ex.getMessage(), ex);
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(INTERNAL, "An unexpected error occurred");
    problem.setType(URI.create("https://ftm.local/errors/internal"));
    problem.setTitle("Internal server error");
    problem.setInstance(URI.create(request.getDescription(false).replace("uri=", "")));
    return problem;
  }
}
