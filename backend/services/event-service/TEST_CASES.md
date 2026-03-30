# Event Service Test Cases

## Summary

| Category | Count | Prefix | File |
|---|---|---|---|
| Unit Tests (Service Layer) | 32 | EVENT-UT | `EventServiceTest.java` |
| Controller Layer Tests (HTTP Integration) | 44 | EVENT-CT | `EventControllerTest.java` |
| Smoke / Context Load | 1 | — | `EventServiceApplicationTests.java` |
| Integration Tests (pre-existing) | 4 | — | `EventControllerIntegrationTest.java` |
| System Tests (Postman) | 21 | EVENT-ST | `src/test/postman/` |
| **Total Automated (Maven)** | **81** | | |
| **Total incl. Postman** | **102** | | |

> **Bug fixed during testing:** `GlobalExceptionHandler` did not handle `ResponseStatusException`, causing internal-service-key validation rejections to return HTTP 500 instead of 403. Added `@ExceptionHandler(ResponseStatusException.class)` to propagate the correct status.

---

## Unit Tests (Service Layer)

**File:** `src/test/java/com/eventzen/event/service/EventServiceTest.java`
**Runner:** `mvn test -Dtest="EventServiceTest"`

| Test ID | Method | Scenario |
|---|---|---|
| EVENT-UT-001 | `createEventRejectsExpectedAttendeesAboveCapacity` | expectedAttendees > capacity → throws |
| EVENT-UT-002 | `adminCreateEventCallsVenueBookingClientWhenVenueProvided` | Admin + venue → ensureAvailability + createBooking called |
| EVENT-UT-003 | `organizerCreateEventDefersVenueBookingUntilApproval` | Organizer + venue → no venue client calls |
| EVENT-UT-004 | `organizerCreatedEventsStartPendingApproval` | Organizer → PENDING_APPROVAL + PENDING + no approvedBudget |
| EVENT-UT-005 | `adminCreatedEventsStartApprovedDraft` | Admin → DRAFT + APPROVED + approvedBudget set |
| EVENT-UT-006 | `updatingDraftEventWithReassignedVenueCreatesBookingAndNotifiesPaymentPending` | Update + new venue on DRAFT → booking created + vendor notified |
| EVENT-UT-007 | `updatingPendingApprovalEventWithVenueDoesNotCreateBookingUntilApproval` | Update + venue on PENDING_APPROVAL → no booking yet |
| EVENT-UT-008 | `addSessionRejectsOverlappingSessions` | Overlapping session times → throws |
| EVENT-UT-009 | `transitionStatusAllowsClosingRegistrationsBackToPublished` | REGISTRATION_OPEN → PUBLISHED |
| EVENT-UT-010 | `transitionStatusAllowsClosingRegistrationsToDedicatedClosedState` | REGISTRATION_OPEN → REGISTRATION_CLOSED |
| EVENT-UT-011 | `transitionStatusAllowsReopeningClosedRegistrations` | REGISTRATION_CLOSED → REGISTRATION_OPEN |
| EVENT-UT-012 | `transitionStatusAllowsMovingPublishedEventBackToDraft` | PUBLISHED → DRAFT |
| EVENT-UT-013 | `transitionStatusAllowsMovingArchivedEventBackToDraft` | ARCHIVED → DRAFT |
| EVENT-UT-014 | `transitionStatusAllowsMovingCompletedEventBackToRegistrationOpen` | COMPLETED → REGISTRATION_OPEN |
| EVENT-UT-015 | `transitionStatusRejectsNonOwningOrganizer` | Different organizer → throws ownership error |
| EVENT-UT-016 | `transitionStatusAllowsAdminToManageAnotherOrganizersEvent` | Admin bypasses ownership check |
| EVENT-UT-017 | `adminDisableNotifiesVendorAndTicketHoldersWithAdminEmail` | Admin disable → organizer + ticket holders notified |
| EVENT-UT-018 | `vendorDisableNotifiesOnlyTicketHoldersWithVendorEmail` | Organizer disable → only ticket holders notified |
| EVENT-UT-019 | `adminEnableNotifiesVendorAndTicketHoldersWithAdminEmail` | Admin enable → organizer + ticket holders notified |
| EVENT-UT-020 | `adminApproveEventRequestAdjustsBudgetAndNotifiesVendor` | Approve → budget adjusted + vendor notified |
| EVENT-UT-021 | `approvingPendingEventWithVenueCreatesBooking` | Approve event with venue → booking created |
| EVENT-UT-022 | `approvingPendingEventWithVenueAndPendingPaymentNotifiesVendor` | Approve + PENDING payment → venue payment notification sent |
| EVENT-UT-023 | `adminRequestChangesNotifiesVendor` | Request-changes → CHANGES_REQUESTED + vendor notified |
| EVENT-UT-024 | `adminRejectEventRequestNotifiesVendor` | Reject → REJECTED + vendor notified |
| EVENT-UT-025 | `cancellingVenueBookingMovesActiveEventBackToDraftAndNotifiesOrganizer` | Venue booking cancelled → DRAFT + organizer notified |
| EVENT-UT-026 | `cancellingVenueBookingMarksPendingApprovalEventForChangesRequested` | Venue cancelled on PENDING_APPROVAL → CHANGES_REQUESTED |
| EVENT-UT-027 | `getEvent_notFound_throwsEventServiceException` | Unknown eventId → throws EventServiceException |
| EVENT-UT-028 | `transitionStatus_blockedWhenEventIsPendingApproval` | PENDING_APPROVAL event → status transition blocked |
| EVENT-UT-029 | `resubmitEventRequest_failsWhenApprovalStatusIsNotChangesRequested` | approvalStatus ≠ CHANGES_REQUESTED → throws |
| EVENT-UT-030 | `resubmitEventRequest_changesApprovalStatusBackToPending` | CHANGES_REQUESTED → PENDING after resubmit |
| EVENT-UT-031 | `requestEnableEvent_failsIfEventIsNotDisabledByAdmin` | Not DISABLED_BY_ADMIN → throws |
| EVENT-UT-032 | `requestEnableEvent_createsEnableRequestWithStatusPending` | DISABLED_BY_ADMIN → enable request saved as PENDING |

---

## Controller Layer Tests (HTTP Integration)

**File:** `src/test/java/com/eventzen/event/controller/EventControllerTest.java`
**Runner:** `mvn test -Dtest="EventControllerTest"`
**Profile:** `test` (H2 in-memory, mocked VenueVendorClient / NotificationClient / TicketingClient)
**Test flow:** Tests are ordered to simulate a full event lifecycle.

| Test ID | Order | Endpoint | Scenario | Expected Status |
|---|---|---|---|---|
| EVENT-CT-001 | 1 | `GET /api/v1/categories` | Public list → id + name fields | 200 |
| EVENT-CT-010 | 10 | `POST /api/v1/events` | No auth token | 401 |
| EVENT-CT-011 | 11 | `POST /api/v1/events` | Missing `title` field | 400 + `$.code=EVENT-400` |
| EVENT-CT-012 | 12 | `POST /api/v1/events` | expectedAttendees > capacity | 4xx |
| EVENT-CT-013 | 13 | `POST /api/v1/events` | Organizer creates Event A → saves `eventAId` + agendaItemIds | 201, PENDING_APPROVAL |
| EVENT-CT-014 | 14 | `POST /api/v1/events` | Organizer creates Event B → saves `eventBId` | 201, PENDING_APPROVAL |
| EVENT-CT-015 | 15 | `POST /api/v1/events` | Admin creates event directly | 201, DRAFT + APPROVED |
| EVENT-CT-020 | 20 | `GET /api/v1/events/{eventAId}` | Public get by ID | 200 with event data |
| EVENT-CT-021 | 21 | `GET /api/v1/events/{randomId}` | Event not found | 404 |
| EVENT-CT-022 | 22 | `GET /api/v1/events` | Public list → paged response | 200 |
| EVENT-CT-023 | 23 | `GET /api/v1/events?q=&status=` | List with query/status filter | 200 |
| EVENT-CT-024 | 24 | `GET /api/v1/events/{id}/agenda` | Public agenda | 200 array |
| EVENT-CT-030 | 30 | `PUT /api/v1/events/{eventAId}` | Owner organizer updates title | 200 updated title |
| EVENT-CT-031 | 31 | `PUT /api/v1/events/{eventAId}` | Different organizer (not owner) | 4xx |
| EVENT-CT-032 | 32 | `PUT /api/v1/events/{eventAId}` | No auth token | 401 |
| EVENT-CT-040 | 40 | `POST /api/v1/events/{id}/sessions` | No auth token | 401 |
| EVENT-CT-041 | 41 | `POST /api/v1/events/{id}/sessions` | Organizer creates session → saves `sessionId` | 201 |
| EVENT-CT-042 | 42 | `PUT /api/v1/events/{id}/sessions/{sId}` | Organizer updates session | 200 |
| EVENT-CT-044 | 44 | `PUT /api/v1/events/{id}/agenda/reorder` | Organizer reorders with reversed IDs | 200 array |
| EVENT-CT-050 | 50 | `POST /api/v1/events/{id}/approval/approve` | Organizer (non-admin) tries to approve | 403 |
| EVENT-CT-051 | 51 | `POST /api/v1/events/{id}/approval/approve` | Admin approves Event A | 200, DRAFT + APPROVED |
| EVENT-CT-052 | 52 | `PATCH /api/v1/events/{id}/status` | Admin transitions DRAFT → PUBLISHED | 200, PUBLISHED |
| EVENT-CT-053 | 53 | `PATCH /api/v1/events/{id}/status` | Null status in body → validation error | 400 |
| EVENT-CT-054 | 54 | `POST /api/v1/events/{id}/approval/request-changes` | Admin requests changes on Event B | 200, CHANGES_REQUESTED |
| EVENT-CT-055 | 55 | `POST /api/v1/events/{id}/approval/resubmit` | Organizer resubmits Event B | 200, PENDING |
| EVENT-CT-056 | 56 | `POST /api/v1/events/{id}/approval/reject` | Admin rejects Event B | 200, REJECTED |
| EVENT-CT-060 | 60 | `POST /api/v1/events/{id}/disable` | Admin disables Event A | 200, DISABLED_BY_ADMIN |
| EVENT-CT-061 | 61 | `POST /api/v1/events/{id}/disable` | No auth token | 401 |
| EVENT-CT-062 | 62 | `POST /api/v1/events/{id}/request-enable` | Organizer requests re-enable → saves `enableReqId` | 200, PENDING |
| EVENT-CT-063 | 63 | `GET /api/v1/events/enable-requests` | Admin lists enable requests | 200 array |
| EVENT-CT-064 | 64 | `GET /api/v1/events/enable-requests` | Organizer (non-admin) lists requests | 403 |
| EVENT-CT-065 | 65 | `POST /api/v1/events/enable-requests/{id}/approve` | Admin approves enable request | 200, PUBLISHED |
| EVENT-CT-066 | 66 | `POST /api/v1/events/{id}/disable` | Admin disables Event A (second time) | 200, DISABLED_BY_ADMIN |
| EVENT-CT-067 | 67 | `POST /api/v1/events/{id}/request-enable` | Organizer submits second enable request → saves `enableReqId2` | 200 |
| EVENT-CT-068 | 68 | `POST /api/v1/events/enable-requests/{id}/reject` | Admin rejects enable request | 204 |
| EVENT-CT-070 | 70 | `DELETE /api/v1/events/{id}/sessions/{sId}` | Organizer deletes session | 204 |
| EVENT-CT-080 | 80 | `DELETE /api/v1/events/{id}` | Organizer tries to delete (admin-only) | 403 |
| EVENT-CT-081 | 81 | `DELETE /api/v1/events/{id}` | No auth token | 401 |
| EVENT-CT-082 | 82 | `DELETE /api/v1/events/{id}` | Admin deletes Event A | 200 with message |
| EVENT-CT-090 | 90 | `POST /api/v1/events/uploads/banner-image` | No auth token | 401 |
| EVENT-CT-091 | 91 | `POST /api/v1/events/uploads/banner-image` | Auth + storage disabled | 503 |
| EVENT-CT-092 | 92 | `POST /api/v1/events/uploads/speaker-photo` | No auth token | 401 |
| EVENT-CT-100 | 100 | `GET /api/v1/internal/events/{id}/booking-owner` | Valid `x-internal-service-key` header | 200 with organizerId |
| EVENT-CT-101 | 101 | `GET /api/v1/internal/events/{id}/booking-owner` | Wrong internal key | 403 |

---

## System Tests (Postman Collection)

**File:** `src/test/postman/event-service-postman-collection.json`
**Environment:** `src/test/postman/event-service-postman-environment.json`

**Prerequisites:**
- Auth service running on `http://localhost:8081`
- Event service running on `http://localhost:8082`

### Newman CLI

```bash
newman run src/test/postman/event-service-postman-collection.json \
  -e src/test/postman/event-service-postman-environment.json \
  --reporters cli,json
```

| Test ID | Folder | Endpoint | Scenario | Expected |
|---|---|---|---|---|
| EVENT-ST-001 | Setup | `POST /auth/login` | Login as organizer → saves `organizerToken` | 200 |
| EVENT-ST-002 | Setup | `POST /auth/login` | Login as admin → saves `adminToken` | 200 |
| EVENT-ST-003 | Setup | `GET /api/v1/categories` | List categories → saves `categoryId` | 200, non-empty |
| EVENT-ST-004 | Event Lifecycle | `POST /api/v1/events` | Organizer creates event → saves `eventId` + agendaIds | 201, PENDING_APPROVAL |
| EVENT-ST-005 | Event Lifecycle | `GET /api/v1/events/{eventId}` | Public get | 200, title matches |
| EVENT-ST-006 | Event Lifecycle | `GET /api/v1/events?q=Cloud` | Public list with filter | 200, paged |
| EVENT-ST-007 | Event Lifecycle | `PUT /api/v1/events/{eventId}` | Organizer updates title | 200, updated |
| EVENT-ST-008 | Event Lifecycle | `POST /api/v1/events/{eventId}/sessions` | Organizer adds session → saves `sessionId` | 201 |
| EVENT-ST-009 | Event Lifecycle | `GET /api/v1/events/{eventId}/agenda` | Public agenda | 200, array |
| EVENT-ST-010 | Event Lifecycle | `PUT /api/v1/events/{eventId}/agenda/reorder` | Organizer reorders agenda | 200, array |
| EVENT-ST-011 | Approval | `POST /api/v1/events/{eventId}/approval/approve` | Admin approves | 200, DRAFT + APPROVED |
| EVENT-ST-012 | Approval | `PATCH /api/v1/events/{eventId}/status` | Admin → PUBLISHED | 200, PUBLISHED |
| EVENT-ST-013 | Approval | `PATCH /api/v1/events/{eventId}/status` | Organizer → REGISTRATION_OPEN | 200 |
| EVENT-ST-014 | Disable/Enable | `POST /api/v1/events/{eventId}/disable` | Admin disables | 200, DISABLED_BY_ADMIN |
| EVENT-ST-015 | Disable/Enable | `POST /api/v1/events/{eventId}/request-enable` | Organizer requests enable → saves `enableRequestId` | 200, PENDING |
| EVENT-ST-016 | Disable/Enable | `GET /api/v1/events/enable-requests` | Admin lists requests | 200, non-empty |
| EVENT-ST-017 | Disable/Enable | `POST /api/v1/events/enable-requests/{id}/approve` | Admin approves re-enable | 200 |
| EVENT-ST-018 | Cleanup | `DELETE /api/v1/events/{eventId}/sessions/{sessionId}` | Delete session | 204 |
| EVENT-ST-019 | Cleanup | `DELETE /api/v1/events/{eventId}` | Admin deletes event | 200, message |
| EVENT-ST-020 | Error Cases | `POST /api/v1/events` | No auth | 401 |
| EVENT-ST-021 | Error Cases | `GET /api/v1/events/00000000-...` | Non-existent event | 404 |

---

## How to Run

### Maven (Unit + Controller tests — no running service needed)

```powershell
cd backend/services/event-service

# All tests
mvn test

# Unit tests only (service layer)
mvn test -Dtest="EventServiceTest"

# Controller tests only (HTTP layer)
mvn test -Dtest="EventControllerTest"

# Existing integration test
mvn test -Dtest="EventControllerIntegrationTest"

# All at once
mvn test -Dtest="EventServiceTest,EventControllerTest,EventControllerIntegrationTest"
```

### Newman (System tests — requires running services)

```powershell
# 1. Start services
docker-compose up auth-service event-service

# 2. Run Newman
npm install -g newman
newman run src/test/postman/event-service-postman-collection.json `
  -e src/test/postman/event-service-postman-environment.json `
  --reporters cli
```

---

## Manual API Coverage (existing)

- Create event as `ADMIN` and `ORGANIZER`.
- Update an organizer-owned event.
- Verify organizer cannot update another organizer's event.
- Transition status `DRAFT <-> PUBLISHED -> REGISTRATION_OPEN <-> PUBLISHED -> ONGOING -> COMPLETED -> ARCHIVED`.
- Reject invalid status transitions.
- Add multiple sessions and confirm agenda/session times stay inside event range.
- Reorder agenda items and verify persisted `sortOrder`.
- Create event with venue booking and confirm booking id is returned.
- Search events by title/type/description and filter by category, city, status, and organizer.

## Frontend Integration Checks

- Public `/events` page loads live events and category filters.
- `/events/:id` loads event detail and agenda.
- `/admin/events` creates events and updates status.
- `/admin/venues` booking form uses live event IDs from event service.
- `/admin/vendors` vendor review/hiring forms use live event IDs from event service.
