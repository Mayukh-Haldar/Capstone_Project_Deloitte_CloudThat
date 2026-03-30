# Ticketing Service – Test Plan & Cases

## Overview

| Layer | Framework | File | Tests |
|---|---|---|---|
| Unit – Service | xUnit 2.9.3 | `TicketingServiceTests.cs` | 25 |
| Unit – JWT | xUnit 2.9.3 | `JwtTokenServiceTests.cs` | 7 |
| Integration – HTTP | xUnit + WebApplicationFactory | `TicketingControllerTests.cs` | 25 |
| System – API | Postman / Newman | `tests/postman/` | 20 |
| **Total** | | | **~77** |

---

## Quick-Start Commands

```powershell
# Run all automated tests
cd backend/services/ticketing-service
dotnet test tests/EventZen.Ticketing.Tests --verbosity normal

# Run only unit tests
dotnet test tests/EventZen.Ticketing.Tests --filter "FullyQualifiedName~TicketingServiceTests|FullyQualifiedName~JwtTokenServiceTests"

# Run only integration (controller) tests
dotnet test tests/EventZen.Ticketing.Tests --filter "FullyQualifiedName~TicketingControllerTests"

# Run a specific test by name
dotnet test tests/EventZen.Ticketing.Tests --filter "FullyQualifiedName~RegisterAsync_FreeTier_CreatesConfirmedRegistration"

# Newman system tests (requires running services)
newman run tests/postman/ticketing-service-postman-collection.json \
  -e tests/postman/ticketing-service-postman-environment.json
```

---

## Unit Tests – TicketingService (TKT-US-*)

> **Location:** `tests/EventZen.Ticketing.Tests/TicketingServiceTests.cs`  
> **Infrastructure:** `InMemoryTicketingRepository`, `CaptureNotificationDispatchClient`, `NoOpSeatHubContext`

| ID | Test Method | Asserts |
|---|---|---|
| TKT-US-001 | `RegisterAsync_CreatesRegistration_AndDecrementsInventory` | PENDING status; AvailableQuantity decremented by 1 |
| TKT-US-002 | `RegisterAsync_RejectsDuplicateRegistration` | `EventZenException` with code `TKT-3002` (HTTP 409) |
| TKT-US-003 | `CancelRegistration_PromotesWaitlistedAttendee` | Waitlisted user transitions to CONFIRMED on cancel |
| TKT-US-004 | `CancelRegistration_SendsCancellationNotificationToAttendee` | `registration.pending_payment` then `registration.cancelled` events fired |
| TKT-US-005 | `ScanAsync_RejectsDuplicateCheckIn` | `EventZenException` with code `TKT-3012` |
| TKT-US-006 | `UpdateTicketTypeAsync_RecalculatesAvailableInventory` | AvailableQuantity = new total – (old total – old available) |
| TKT-US-007 | `UpdateTicketTypeAsync_RejectsReducingBelowBookedCount` | `EventZenException` with code `TKT-3024` |
| TKT-US-008 | `DeleteTicketTypeAsync_SoftDeletesUnusedTier` | `IsActive = false` after delete |
| TKT-US-009 | `DeleteTicketTypeAsync_RejectsBookedTier` | `EventZenException` with code `TKT-3025` |
| TKT-US-010 | `RegisterAsync_SoldOut_ThrowsTkt3001` | `EventZenException` with code `TKT-3001` (HTTP 409) |
| TKT-US-011 | `RegisterAsync_FreeTier_CreatesConfirmedRegistration` | Price = 0 → CONFIRMED status immediately |
| TKT-US-012 | `RegisterAsync_IdempotentKey_ReturnsSameRegistration` | Second registration for same user rejected with `TKT-3002` |
| TKT-US-013 | `ConfirmRegistrationPaymentAsync_TransitionsPendingToConfirmed` | PENDING → CONFIRMED after confirm-payment call |
| TKT-US-014 | `ConfirmRegistrationPaymentAsync_IsIdempotentForAlreadyConfirmed` | Already-CONFIRMED registration stays CONFIRMED |
| TKT-US-015 | `JoinWaitlistAsync_CreatesWaitlistEntry` | `WaitlistEntryId != Guid.Empty`, `Status == "ACTIVE"` |
| TKT-US-016 | `JoinWaitlistAsync_IsIdempotentForSameUser` | Second join for same user returns same `WaitlistId` |
| TKT-US-017 | `ListMyRegistrationsAsync_ReturnsOnlyCallerRegistrations` | Alice's list ≠ Bob's list; each sees only their own entry |
| TKT-US-018 | `ListTicketTypesAsync_ReturnsActiveTypes` | 2 active types returned; soft-deleted type excluded |
| TKT-US-019 | `CreateTicketTypeAsync_RejectsZeroQuantity_ThrowsTkt3006` | `EventZenException` code `TKT-3006` (HTTP 400) |
| TKT-US-020 | `GetCheckInStatsAsync_ReturnsCorrectCounts` | `CheckedInCount = 1`, `TotalRegistrations = 2` |
| TKT-US-021 | `ScanAsync_ChecksInAttendee_StatusBecomesCheckedIn` | Status = `CHECKED_IN`, `CheckedInAt != null` |
| TKT-US-022 | `CancelRegistrationAsync_RestoresInventory` | AvailableQuantity restored after cancellation |
| TKT-US-023 | `ListRegistrationsForEventAsync_ReturnsAllEventRegistrations` | All 3 registrations for eventId returned |
| TKT-US-024 | `CancelRegistrationAsync_WrongOwner_ThrowsAuth1003` | `EventZenException` code `AUTH-1003` (HTTP 403) |
| TKT-US-025 | `RegisterAsync_FreeTier_FiresConfirmedNotification` | `registration.confirmed` event fired; no `pending_payment` event |

---

## Unit Tests – JwtTokenService (TKT-JWT-*)

> **Location:** `tests/EventZen.Ticketing.Tests/JwtTokenServiceTests.cs`

| ID | Test Method | Asserts |
|---|---|---|
| TKT-JWT-001 | `ParseAccessToken_Reads_AuthServiceClaims` | HS512 token; `ROLE_` prefix stripped; `uid` → `UserId` |
| TKT-JWT-002 | `ParseAccessToken_HS256_Works` | HS256 token accepted; roles extracted correctly |
| TKT-JWT-003 | `ParseAccessToken_ExpiredToken_Throws` | `exp` 5 min in past → exception thrown |
| TKT-JWT-004 | `ParseAccessToken_WrongIssuer_Throws` | Issuer `"rogue-service"` rejected |
| TKT-JWT-005 | `ParseAccessToken_WrongType_Throws` | `type = "refresh"` rejected |
| TKT-JWT-006 | `ParseAccessToken_InvalidSignature_Throws` | Token signed with wrong secret → exception |
| TKT-JWT-007 | `ParseAccessToken_MalformedToken_Throws` | `"not.a.jwt"` → exception |

---

## Integration Tests – HTTP Layer (TKT-CT-*)

> **Location:** `tests/EventZen.Ticketing.Tests/TicketingControllerTests.cs`  
> **Infrastructure:** `WebApplicationFactory<Program>`, `TicketingIntegrationRepository` (in-memory), dev-header auth fallback (`x-user-id` / `x-user-roles`)

| ID | Test Method | HTTP | Asserts |
|---|---|---|---|
| TKT-CT-001 | `TKT_CT_001_HealthEndpoint_Returns200` | `GET /api/v1/health` | 200 |
| TKT-CT-002 | `TKT_CT_002_ListTicketTypes_PublicAccess_Returns200EmptyArray` | `GET /api/v1/ticket-types?eventId=` | 200, JSON array |
| TKT-CT-003 | `TKT_CT_003_CreateTicketType_NoAuth_Returns401` | `POST /api/v1/events/{id}/ticket-types` | 401 |
| TKT-CT-004 | `TKT_CT_004_CreateTicketType_AsOrganizer_Returns200` | `POST /api/v1/events/{id}/ticket-types` | 200, `ticketName` correct |
| TKT-CT-005 | `TKT_CT_005_CreateTicketType_ZeroQuantity_Returns400` | `POST /api/v1/events/{id}/ticket-types` | 400 |
| TKT-CT-006 | `TKT_CT_006_UpdateTicketType_AsOrganizer_Returns200` | `PUT /api/v1/events/{id}/ticket-types/{typeId}` | 200, `ticketName` updated |
| TKT-CT-007 | `TKT_CT_007_DeleteTicketType_Unused_Returns204` | `DELETE /api/v1/events/{id}/ticket-types/{typeId}` | 204 |
| TKT-CT-008 | `TKT_CT_008_Register_NoAuth_Returns401` | `POST /api/v1/registrations` | 401 |
| TKT-CT-009 | `TKT_CT_009_Register_AsAttendee_ReturnsPendingRegistration` | `POST /api/v1/registrations` | 200, `status = PENDING` |
| TKT-CT-010 | `TKT_CT_010_Register_FreeTier_ReturnsConfirmedRegistration` | `POST /api/v1/registrations` | 200, `status = CONFIRMED` |
| TKT-CT-011 | `TKT_CT_011_MyRegistrations_AsAttendee_ReturnsList` | `GET /api/v1/registrations/me` | 200, array ≥ 1 element |
| TKT-CT-012 | `TKT_CT_012_MyTickets_AsAttendee_ReturnsList` | `GET /api/v1/tickets/me` | 200, array ≥ 1 element |
| TKT-CT-013 | `TKT_CT_013_EventRegistrations_AsAdmin_Returns200` | `GET /api/v1/events/{id}/registrations` | 200, array |
| TKT-CT-014 | `TKT_CT_014_EventRegistrations_WithInternalKey_Returns200` | `GET /api/v1/events/{id}/registrations` | 200 (no auth header) |
| TKT-CT-015 | `TKT_CT_015_EventRegistrations_NoAuth_Returns401` | `GET /api/v1/events/{id}/registrations` | 401 |
| TKT-CT-016 | `TKT_CT_016_EventRegistrations_AsAttendee_Returns403` | `GET /api/v1/events/{id}/registrations` | 403 |
| TKT-CT-017 | `TKT_CT_017_ConfirmPayment_ValidKey_ReturnsConfirmed` | `POST /api/v1/internal/registrations/{id}/confirm-payment` | 200, `status = CONFIRMED` |
| TKT-CT-018 | `TKT_CT_018_ConfirmPayment_WrongKey_Returns403` | `POST /api/v1/internal/registrations/{id}/confirm-payment` | 403 |
| TKT-CT-019 | `TKT_CT_019_JoinWaitlist_SoldOutEvent_Returns200` | `POST /api/v1/events/{id}/waitlist` | 200, `status = ACTIVE` |
| TKT-CT-020 | `TKT_CT_020_CancelRegistration_AsOwner_Returns204` | `DELETE /api/v1/registrations/{id}` | 204 |
| TKT-CT-021 | `TKT_CT_021_CancelRegistration_DifferentUser_Returns403` | `DELETE /api/v1/registrations/{id}` | 403 |
| TKT-CT-022 | `TKT_CT_022_CheckInScan_AsStaff_ReturnsCheckedIn` | `POST /api/v1/checkin/scan` | 200, `status = CHECKED_IN` |
| TKT-CT-023 | `TKT_CT_023_CheckInScan_NoAuth_Returns401` | `POST /api/v1/checkin/scan` | 401 |
| TKT-CT-024 | `TKT_CT_024_CheckInStats_AsOrganizer_ReturnsStats` | `GET /api/v1/events/{id}/checkin/stats` | 200, `checkedInCount >= 1` |
| TKT-CT-025 | `TKT_CT_025_SeatMap_PublicEndpoint_Returns200` | `GET /api/v1/ticket-types/{id}/seat-map?eventId=` | 200, `capacity` + `rows` present |

---

## System Tests – Postman (TKT-ST-*)

> **Location:** `tests/postman/ticketing-service-postman-collection.json`  
> **Environment:** `tests/postman/ticketing-service-postman-environment.json`  
> **Pre-requisite:** Full stack running; JWT tokens stored in environment variables

| ID | Request | Expected |
|---|---|---|
| TKT-ST-001 | `GET /api/v1/health` | 200, `status = UP` |
| TKT-ST-002 | `GET /api/v1/ticket-types?eventId={{eventId}}` | 200, array |
| TKT-ST-003 | `POST /api/v1/events/{{eventId}}/ticket-types` (ORGANIZER) | 200, `ticketTypeId` populated |
| TKT-ST-004 | `POST /api/v1/events/{{eventId}}/ticket-types` (no auth) | 401 |
| TKT-ST-005 | `POST /api/v1/events/{{eventId}}/ticket-types` (ATTENDEE) | 403 |
| TKT-ST-006 | `PUT /api/v1/events/{{eventId}}/ticket-types/{{ticketTypeId}}` (ORGANIZER) | 200, updated name |
| TKT-ST-007 | `POST /api/v1/registrations` (ATTENDEE) | 200, `status = PENDING`, saves `registrationId` / `qrPayload` |
| TKT-ST-008 | `POST /api/v1/registrations` (no auth) | 401 |
| TKT-ST-009 | `POST /api/v1/registrations` duplicate (ATTENDEE) | 409, `code = TKT-3002` |
| TKT-ST-010 | `GET /api/v1/registrations/me` (ATTENDEE) | 200, ≥ 1 entry |
| TKT-ST-011 | `POST /api/v1/internal/registrations/{{registrationId}}/confirm-payment` (valid key) | 200, `status = CONFIRMED` |
| TKT-ST-012 | `POST /api/v1/internal/registrations/{{registrationId}}/confirm-payment` (wrong key) | 403 |
| TKT-ST-013 | `GET /api/v1/events/{{eventId}}/registrations` (ADMIN) | 200, array with ≥ 1 entry |
| TKT-ST-014 | `DELETE /api/v1/registrations/{{registrationId}}` (owner) | 204 |
| TKT-ST-015 | `GET /api/v1/tickets/me` (ATTENDEE) | 200, array |
| TKT-ST-016 | `GET /api/v1/tickets/{{ticketId}}` (ATTENDEE / owner) | 200, `ticketId` matches |
| TKT-ST-017 | `POST /api/v1/events/{{eventId}}/waitlist` (ATTENDEE) | 200, `status = ACTIVE` |
| TKT-ST-018 | `POST /api/v1/checkin/scan` (STAFF, valid `qrPayload`) | 200, `status = CHECKED_IN` |
| TKT-ST-019 | `GET /api/v1/events/{{eventId}}/checkin/stats` (ORGANIZER) | 200, `checkedInCount >= 1` |
| TKT-ST-020 | `GET /api/v1/ticket-types/{{ticketTypeId}}/seat-map?eventId=` | 200, `capacity`, `rows` |

---

## Error Code Reference

| Code | HTTP | Trigger |
|---|---|---|
| `AUTH-1002` | 401 | Authentication required (`RequireUser()` with no valid principal) |
| `AUTH-1003` | 403 | Insufficient role (`RequireRoles(...)` fails) or wrong owner |
| `TKT-3001` | 409 | Ticket type sold out (`AvailableQuantity == 0`) |
| `TKT-3002` | 409 | Duplicate registration (same user + same event) |
| `TKT-3006` | 400 | `TotalQuantity <= 0` on create |
| `TKT-3007` | 404 | Ticket type not found |
| `TKT-3011` | 400 | QR signature validation failed |
| `TKT-3012` | 409 | Already checked in |
| `TKT-3013` | 409 | Canceled registration cannot be confirmed |
| `TKT-3014` | 409 | Event is not bookable (status ≠ `REGISTRATION_OPEN`) |
| `TKT-3015` | 409 | Seat already booked by another attendee |
| `TKT-3020` | 409 | Seat reserved by a different user |
| `TKT-3024` | 409 | New `totalQuantity` < already-booked count |
| `TKT-3025` | 409 | Ticket type has bookings and cannot be deleted |

---

## Test Infrastructure Notes

### Unit Test Infrastructure (in `TicketingServiceTests.cs`)

- **`InMemoryTicketingRepository`** – full implementation of all 28+ `ITicketingRepository` methods using `Dictionary<Guid, T>` collections.
- **`CaptureNotificationDispatchClient`** – records `eventType` strings in `List<string> Events`.
- **`NoOpSeatHubContext`** – silent SignalR context so no real SignalR connections are needed.
- **`CreateService()`** – factory that wires `TicketingService` with stub `EventCatalogClient` returning a fixed `REGISTRATION_OPEN` event and optional notification capture.

### Integration Test Infrastructure (in `TicketingControllerTests.cs`)

- **`TicketingWebApplicationFactory`** replaces:
  - `ITicketingRepository` → `TicketingIntegrationRepository` (in-memory)
  - `INotificationDispatchClient` → no-op singleton
  - `EventCatalogClient` HTTP handler → `StubEventCatalogHandler` (returns valid event for any ID)
  - `SampleTicketingSeeder` background service removed
- **Dev-header auth:** `x-user-id`, `x-user-email`, `x-user-roles` work because of `UseEnvironment("Development")`.
- **Internal service key:** configured as `"test-internal-key"` in test app configuration.
- **JWT secret:** `"change-me-change-me-change-me-change-me-1234567890"` (same for unit and integration).
