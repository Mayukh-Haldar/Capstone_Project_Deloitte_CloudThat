package com.eventzen.event.repository;

import com.eventzen.event.model.EventAgendaItem;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventAgendaItemRepository extends JpaRepository<EventAgendaItem, UUID> {
    List<EventAgendaItem> findByEventIdOrderBySortOrderAsc(UUID eventId);
}
