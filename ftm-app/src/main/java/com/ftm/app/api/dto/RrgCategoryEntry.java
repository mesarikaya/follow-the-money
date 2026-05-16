package com.ftm.app.api.dto;

import java.util.List;

public record RrgCategoryEntry(
        String id,
        String name,
        String color,
        int quadrant,
        List<RrgTrailPoint> trail
) {}
