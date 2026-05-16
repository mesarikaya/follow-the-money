package com.ftm.app.api.dto;

import java.time.LocalDate;
import java.util.List;

public record RrgResponse(LocalDate date, List<RrgCategoryEntry> categories) {}
