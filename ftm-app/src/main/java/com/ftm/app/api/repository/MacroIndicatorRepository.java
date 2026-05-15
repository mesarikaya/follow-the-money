package com.ftm.app.api.repository;

import com.ftm.app.domain.MacroIndicator;
import com.ftm.app.domain.MacroIndicatorId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface MacroIndicatorRepository extends JpaRepository<MacroIndicator, MacroIndicatorId> {

    @Query("""
            SELECT m FROM MacroIndicator m
            WHERE m.observationDate = (
                SELECT MAX(m2.observationDate) FROM MacroIndicator m2
                WHERE m2.seriesId = m.seriesId
            )
            """)
    List<MacroIndicator> findLatestPerSeries();
}
