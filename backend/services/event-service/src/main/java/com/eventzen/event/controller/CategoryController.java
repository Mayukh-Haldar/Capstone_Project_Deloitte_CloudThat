package com.eventzen.event.controller;

import com.eventzen.event.dto.CategoryResponse;
import com.eventzen.event.service.CategoryService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/categories")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    List<CategoryResponse> listCategories() {
        return categoryService.listCategories();
    }
}
