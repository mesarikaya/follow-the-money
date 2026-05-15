package com.ftm.app.domain;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;

public class SignalId implements Serializable {

    private LocalDate signalDate;
    private String categoryId;
    private String signalType;

    public SignalId() {}

    public SignalId(LocalDate signalDate, String categoryId, String signalType) {
        this.signalDate = signalDate;
        this.categoryId = categoryId;
        this.signalType = signalType;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof SignalId that)) return false;
        return Objects.equals(signalDate, that.signalDate)
                && Objects.equals(categoryId, that.categoryId)
                && Objects.equals(signalType, that.signalType);
    }

    @Override
    public int hashCode() { return Objects.hash(signalDate, categoryId, signalType); }
}
