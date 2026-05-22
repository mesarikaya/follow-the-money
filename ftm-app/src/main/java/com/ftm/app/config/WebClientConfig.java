package com.ftm.app.config;

import com.ftm.app.ingestion.client.FredClient;
import com.ftm.app.ingestion.client.YahooFinanceClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class WebClientConfig {

  @Bean
  public YahooFinanceClient yahooFinanceClient(FtmProperties props) {
    return new YahooFinanceClient(RestClient.builder(), props.yahoo().baseUrl());
  }

  @Bean
  public FredClient fredClient(FtmProperties props) {
    return new FredClient(RestClient.builder(), props.fred().baseUrl(), props.fred().apiKey());
  }
}
