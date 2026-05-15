package com.ftm.app.api.repository;

import com.ftm.app.domain.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CategoryRepository extends JpaRepository<Category, String> {

    List<Category> findAllByActiveTrueOrderByDisplayOrderAsc();
}
