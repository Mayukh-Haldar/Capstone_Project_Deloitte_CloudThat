package com.eventzen.event.controller;
import com.eventzen.event.dto.AgendaItemResponse;
import com.eventzen.event.dto.ApiMessageResponse;
import com.eventzen.event.dto.CreateEventRequest;
import com.eventzen.event.dto.CreateSessionRequest;
import com.eventzen.event.dto.EventDetailResponse;
import com.eventzen.event.dto.EventEnableRequestResponse;
import com.eventzen.event.dto.EventSummaryResponse;
import com.eventzen.event.dto.PagedResponse;
import com.eventzen.event.dto.ReorderAgendaRequest;
import com.eventzen.event.dto.SessionResponse;
import com.eventzen.event.dto.TransitionEventStatusRequest;
import com.eventzen.event.dto.UpdateEventRequest;
import com.eventzen.event.dto.UpdateSessionRequest;
import com.eventzen.event.dto.UploadedAssetResponse;
import com.eventzen.event.model.EventStatus;
import com.eventzen.event.security.AuthenticatedUser;
import com.eventzen.event.service.EventAssetService;
import com.eventzen.event.service.EventService;
import com.eventzen.event.config.EventClientProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import java.time.OffsetDateTime;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/events")
public class EventController {

    private final EventService eventService;
    private final EventAssetService eventAssetService;
    private final EventClientProperties eventClientProperties;

    public EventController(EventService eventService, EventAssetService eventAssetService, EventClientProperties eventClientProperties) {
        this.eventService = eventService;
        this.eventAssetService = eventAssetService;
        this.eventClientProperties = eventClientProperties;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','ORGANIZER')")
    EventDetailResponse createEvent(
            @Valid @RequestBody CreateEventRequest request,
            @AuthenticationPrincipal AuthenticatedUser actor,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization
    ) {
        return eventService.createEvent(request, actor, authorization);
    }

    @GetMapping
    PagedResponse<EventSummaryResponse> listEvents(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) EventStatus status,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) UUID organizerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to
    ) {
        return eventService.listEvents(q, category, status, city, from, to, organizerId, page, size);
    }

    @GetMapping("/{id}")
    EventDetailResponse getEvent(@PathVariable UUID id) {
        return eventService.getEvent(id);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ORGANIZER')")
    EventDetailResponse updateEvent(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateEventRequest request,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @AuthenticationPrincipal AuthenticatedUser actor
    ) {
        return eventService.updateEvent(id, request, actor, authorization);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','ORGANIZER')")
    EventDetailResponse transitionStatus(
            @PathVariable UUID id,
            @Valid @RequestBody TransitionEventStatusRequest request,
            @AuthenticationPrincipal AuthenticatedUser actor
    ) {
        return eventService.transitionStatus(id, request, actor);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    ApiMessageResponse archiveEvent(@PathVariable UUID id) {
        eventService.archiveEvent(id);
        return new ApiMessageResponse("Event archived successfully");
    }

    @PostMapping("/{id}/disable")
    @PreAuthorize("hasAnyRole('ADMIN','ORGANIZER')")
    EventDetailResponse disableEvent(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedUser actor,
            @RequestHeader(org.springframework.http.HttpHeaders.AUTHORIZATION) String authorization
    ) {
        return eventService.disableEvent(id, actor, authorization);
    }

    @PostMapping("/{id}/enable")
    @PreAuthorize("hasAnyRole('ADMIN','ORGANIZER')")
    EventDetailResponse enableEvent(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedUser actor,
            @RequestHeader(org.springframework.http.HttpHeaders.AUTHORIZATION) String authorization
    ) {
        return eventService.enableEvent(id, actor, authorization);
    }

    @PostMapping("/{id}/request-enable")
    @PreAuthorize("hasRole('ORGANIZER')")
    EventEnableRequestResponse requestEnableEvent(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedUser actor,
            @RequestBody(required = false) NoteBody body
    ) {
        return eventService.requestEnableEvent(id, actor, body != null ? body.note() : null);
    }

    @GetMapping("/enable-requests")
    @PreAuthorize("hasRole('ADMIN')")
    List<EventEnableRequestResponse> listPendingEnableRequests() {
        return eventService.listPendingEnableRequests();
    }

    @PostMapping("/enable-requests/{requestId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    EventDetailResponse approveEnableRequest(
            @PathVariable UUID requestId,
            @AuthenticationPrincipal AuthenticatedUser actor,
            @RequestHeader(org.springframework.http.HttpHeaders.AUTHORIZATION) String authorization,
            @RequestBody(required = false) NoteBody body
    ) {
        return eventService.approveEnableRequest(requestId, actor, authorization, body != null ? body.note() : null);
    }

    @PostMapping("/enable-requests/{requestId}/reject")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    void rejectEnableRequest(
            @PathVariable UUID requestId,
            @AuthenticationPrincipal AuthenticatedUser actor,
            @RequestBody(required = false) NoteBody body
    ) {
        eventService.rejectEnableRequest(requestId, actor, body != null ? body.note() : null);
    }

    @PostMapping("/{id}/approval/approve")
    @PreAuthorize("hasRole('ADMIN')")
    EventDetailResponse approveEventRequest(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedUser actor,
            @RequestHeader(org.springframework.http.HttpHeaders.AUTHORIZATION) String authorization,
            @RequestBody(required = false) ApprovalReviewBody body
    ) {
        return eventService.approveEventRequest(
                id,
                actor,
                authorization,
                body != null ? body.approvedBudget() : null,
                body != null ? body.note() : null);
    }

    @PostMapping("/{id}/approval/request-changes")
    @PreAuthorize("hasRole('ADMIN')")
    EventDetailResponse requestEventChanges(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedUser actor,
            @RequestBody(required = false) ApprovalReviewBody body
    ) {
        return eventService.requestEventRevision(id, actor, body != null ? body.note() : null);
    }

    @PostMapping("/{id}/approval/reject")
    @PreAuthorize("hasRole('ADMIN')")
    EventDetailResponse rejectEventRequest(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedUser actor,
            @RequestBody(required = false) ApprovalReviewBody body
    ) {
        return eventService.rejectEventRequest(id, actor, body != null ? body.note() : null);
    }

    @PostMapping("/{id}/approval/resubmit")
    @PreAuthorize("hasRole('ORGANIZER')")
    EventDetailResponse resubmitEventRequest(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedUser actor
    ) {
        return eventService.resubmitEventRequest(id, actor);
    }

    @PostMapping("/internal/venue-bookings/{bookingId}/cancelled")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void handleVenueBookingCancelled(
            @PathVariable String bookingId,
            @RequestHeader("x-internal-service-key") String internalServiceKey,
            @RequestBody(required = false) VenueCancellationBody body
    ) {
        if (!eventClientProperties.notificationInternalServiceKey().equals(internalServiceKey)) {
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid internal service key");
        }
        eventService.handleVenueBookingCancelled(bookingId, body != null ? body.reason() : null);
    }

    private record NoteBody(String note) {}
    private record ApprovalReviewBody(@DecimalMin("0.0") BigDecimal approvedBudget, String note) {}
    private record VenueCancellationBody(String reason) {}

    @PostMapping(value = "/uploads/banner-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','ORGANIZER')")
    UploadedAssetResponse uploadBannerImage(@RequestParam("file") MultipartFile file) {
        return eventAssetService.uploadBannerImage(file);
    }

    @PostMapping(value = "/uploads/speaker-photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','ORGANIZER')")
    UploadedAssetResponse uploadSpeakerPhoto(@RequestParam("file") MultipartFile file) {
        return eventAssetService.uploadSpeakerPhoto(file);
    }

    @PostMapping("/{id}/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','ORGANIZER')")
    SessionResponse addSession(
            @PathVariable UUID id,
            @Valid @RequestBody CreateSessionRequest request,
            @AuthenticationPrincipal AuthenticatedUser actor
    ) {
        return eventService.addSession(id, request, actor);
    }

    @PutMapping("/{id}/sessions/{sessionId}")
    @PreAuthorize("hasAnyRole('ADMIN','ORGANIZER')")
    SessionResponse updateSession(
            @PathVariable UUID id,
            @PathVariable UUID sessionId,
            @Valid @RequestBody UpdateSessionRequest request,
            @AuthenticationPrincipal AuthenticatedUser actor
    ) {
        return eventService.updateSession(id, sessionId, request, actor);
    }

    @DeleteMapping("/{id}/sessions/{sessionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMIN','ORGANIZER')")
    void deleteSession(
            @PathVariable UUID id,
            @PathVariable UUID sessionId,
            @AuthenticationPrincipal AuthenticatedUser actor
    ) {
        eventService.deleteSession(id, sessionId, actor);
    }

    @GetMapping("/{id}/agenda")
    List<AgendaItemResponse> getAgenda(@PathVariable UUID id) {
        return eventService.getAgenda(id);
    }

    @PutMapping("/{id}/agenda/reorder")
    @PreAuthorize("hasAnyRole('ADMIN','ORGANIZER')")
    List<AgendaItemResponse> reorderAgenda(
            @PathVariable UUID id,
            @Valid @RequestBody ReorderAgendaRequest request,
            @AuthenticationPrincipal AuthenticatedUser actor
    ) {
        return eventService.reorderAgenda(id, request, actor);
    }

    @GetMapping("/search")
    List<EventSummaryResponse> search(@RequestParam String q) {
        return eventService.search(q);
    }
}
