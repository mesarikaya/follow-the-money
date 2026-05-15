package com.ftm.app.domain;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;

public class MacroIndicatorId implements Serializable {

    private LocalDate observationDate;
    private String seriesId;

    public MacroIndicatorId() {}

    public MacroIndicatorId(LocalDate observationDate, String seriesId) {
        this.observationDate = observationDate;
        this.seriesId = seriesId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof MacroIndicatorId that)) return false;
        return Objects.equals(observationDate, that.observationDate) && Objects.equals(seriesId, that.seriesId);
    }

    @Override
    public int hashCode() { return Objects.hash(observationDate, seriesId); }
}
