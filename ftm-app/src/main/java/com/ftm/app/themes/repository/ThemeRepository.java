package com.ftm.app.themes.repository;

import com.ftm.app.domain.Theme;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class ThemeRepository {

  private final DSLContext dsl;

  public ThemeRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  public List<Theme> findAll() {
    return dsl.resultQuery("SELECT id, name, thesis, display_order FROM themes ORDER BY display_order")
        .fetch()
        .map(r -> new Theme(
            r.get("id", String.class),
            r.get("name", String.class),
            r.get("thesis", String.class),
            r.get("display_order", Integer.class)));
  }

  public Map<String, List<String>> findAllConstituentsByTheme() {
    return dsl.resultQuery("SELECT theme_id, category_id FROM theme_constituents ORDER BY theme_id, category_id")
        .fetch()
        .stream()
        .collect(Collectors.groupingBy(
            r -> r.get("theme_id", String.class),
            Collectors.mapping(r -> r.get("category_id", String.class), Collectors.toList())));
  }
}
