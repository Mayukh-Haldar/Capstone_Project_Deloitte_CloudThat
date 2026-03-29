package com.eventzen.event.controller;

import com.eventzen.event.config.EventClientProperties;
import com.eventzen.event.service.EventService;
import io.swagger.v3.oas.annotations.Hidden;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@Hidden
@RestController
@RequestMapping("/api/v1/internal/events")
public class InternalEventController {

    private final EventService eventService;
    private final EventClientProperties eventClientProperties;

    public InternalEventController(EventService eventService, EventClientProperties eventClientProperties) {
        this.eventService = eventService;
        this.eventClientProperties = eventClientProperties;
    }

    @GetMapping("/{id}/booking-owner")
    EventService.EventBookingOwnerResponse getBookingOwner(
            @PathVariable UUID id,
            @RequestHeader("x-internal-service-key") String internalServiceKey
    ) {
        String expectedInternalServiceKey = eventClientProperties.notificationInternalServiceKey();
        if (expectedInternalServiceKey == null || expectedInternalServiceKey.isBlank() || !expectedInternalServiceKey.equals(internalServiceKey)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid internal service key");
        }
        return eventService.getBookingOwner(id);
    }
}
