package com.eventzen.event.repository;

import com.eventzen.event.model.EventEnableRequest;
import com.eventzen.event.model.EventEnableRequestStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventEnableRequestRepository extends JpaRepository<EventEnableRequest, UUID> {

    List<EventEnableRequest> findByStatusOrderByRequestedAtDesc(EventEnableRequestStatus status);

    boolean existsByEventIdAndVendorIdAndStatus(UUID eventId, UUID vendorId, EventEnableRequestStatus status);
}
