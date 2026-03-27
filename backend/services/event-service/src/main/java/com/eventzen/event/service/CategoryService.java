package com.eventzen.event.service;

import com.eventzen.event.dto.CategoryResponse;
import com.eventzen.event.repository.EventCategoryRepository;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class CategoryService {

    private final EventCategoryRepository categoryRepository;
    private final EventMapper mapper;

    public CategoryService(EventCategoryRepository categoryRepository, EventMapper mapper) {
        this.categoryRepository = categoryRepository;
        this.mapper = mapper;
    }

    public List<CategoryResponse> listCategories() {
        return categoryRepository.findAll().stream().map(mapper::toCategoryResponse).toList();
    }
}
