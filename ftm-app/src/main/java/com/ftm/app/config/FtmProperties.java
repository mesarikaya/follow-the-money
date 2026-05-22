package com.ftm.app.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "ftm")
public record FtmProperties(@Valid Fred fred, @Valid Yahoo yahoo) {

  public record Fred(@NotBlank String baseUrl, @NotBlank String apiKey) {}

  public record Yahoo(@NotBlank String baseUrl) {}
}
