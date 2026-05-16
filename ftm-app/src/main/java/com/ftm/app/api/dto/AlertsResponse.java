package com.ftm.app.api.dto;

import java.util.List;

public record AlertsResponse(
        int activeCount,
        List<AlertDto> alerts
) {}
