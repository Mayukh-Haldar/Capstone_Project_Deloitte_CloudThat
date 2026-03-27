package com.eventzen.event.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record VenueBookingRequest(
        @NotBlank String venueId,
        String venueName,
        String venueCity,
        List<String> hallIds
) {
}
