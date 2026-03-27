package com.eventzen.event.repository;

import com.eventzen.event.model.EventCategory;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventCategoryRepository extends JpaRepository<EventCategory, UUID> {
}
