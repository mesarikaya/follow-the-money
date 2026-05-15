package com.ftm.app.domain;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;

public class RawPriceId implements Serializable {

    private LocalDate tradeDate;
    private String categoryId;

    public RawPriceId() {}

    public RawPriceId(LocalDate tradeDate, String categoryId) {
        this.tradeDate = tradeDate;
        this.categoryId = categoryId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RawPriceId that)) return false;
        return Objects.equals(tradeDate, that.tradeDate) && Objects.equals(categoryId, that.categoryId);
    }

    @Override
    public int hashCode() { return Objects.hash(tradeDate, categoryId); }
}
