package com.ftm.app.api.dto;

import java.math.BigDecimal;

public record RebalanceSuggestionDto(
        String categoryId,
        String categoryName,
        String action,
        BigDecimal currentAllocationPct,
        BigDecimal optimalAllocationPct,
        BigDecimal deltaPct
) {}
