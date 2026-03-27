package com.eventzen.event.repository;

import com.eventzen.event.model.EventSession;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventSessionRepository extends JpaRepository<EventSession, UUID> {
    List<EventSession> findByEventIdOrderByStartTimeAsc(UUID eventId);
}
