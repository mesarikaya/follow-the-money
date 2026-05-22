package com.ftm.app.ingestion.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record FredObservationsResponse(List<Observation> observations) {

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Observation(
      @JsonProperty("date") String date, @JsonProperty("value") String value) {
    public boolean isMissing() {
      return ".".equals(value);
    }
  }
}
