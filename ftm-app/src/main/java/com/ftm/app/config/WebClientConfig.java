package com.ftm.app.config;

import com.ftm.app.ingestion.client.FredClient;
import com.ftm.app.ingestion.client.YahooFinanceClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class WebClientConfig {

    @Bean
    public YahooFinanceClient yahooFinanceClient(RestClient.Builder builder, FtmProperties props) {
        return new YahooFinanceClient(builder, props.yahoo().baseUrl());
    }

    @Bean
    public FredClient fredClient(RestClient.Builder builder, FtmProperties props) {
        return new FredClient(builder, props.fred().baseUrl(), props.fred().apiKey());
    }
}
