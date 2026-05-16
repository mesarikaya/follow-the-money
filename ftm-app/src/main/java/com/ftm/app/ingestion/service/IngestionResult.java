package com.ftm.app.ingestion.service;

import java.util.List;

public record IngestionResult(int rowsInserted, List<String> errors) {

    public static IngestionResult success(int rows) {
        return new IngestionResult(rows, List.of());
    }

    public static IngestionResult partial(int rows, List<String> errors) {
        return new IngestionResult(rows, List.copyOf(errors));
    }

    public boolean hasErrors() {
        return !errors.isEmpty();
    }
}
