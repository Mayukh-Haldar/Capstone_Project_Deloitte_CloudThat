[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 📋 Account Request & Approval Workflow

## Overview

EventZen uses a **gated onboarding model** for privileged roles. Vendors and Organizers cannot self-register and immediately access platform features - they must submit an **Account Request** that an admin reviews and either approves or rejects. This prevents unauthorized use of event management or venue-vendor capabilities while still allowing self-service for regular Attendee accounts.

---

## Workflow Diagram

```
User (Vendor / Organizer)           Admin               Auth Service
        │                              │                      │
        │── POST /account-requests ───▶│── submit() ────────▶ DB
        │   { type: UPGRADE_TO_ORGANIZER,               (Status: PENDING)
        │     reason: "..." }          │                      │
        │                              │                      │
        │                   Admin lists pending requests       │
        │                   GET /admin/account-requests        │
        │                              │                      │
        │                   Admin reviews                     │
        │                   PUT /admin/account-requests/{id}/approve
        │                              │── approveRequest() ─▶│
        │                              │   Assign role        │
        │                              │   Notify user        │
        │◀── Kafka notification ───────────────────────────── │
        │    "Account approved"        │                      │
```

---

## Request Types

| Type | Description |
|---|---|
| `UPGRADE_TO_ORGANIZER` | Attendee requests Event Organizer access |
| `UPGRADE_TO_VENDOR` | Attendee requests Venue Vendor access |
| `REACTIVATE` | Deactivated user requests account reactivation |

---

## Key Source Files

| File | Purpose |
|---|---|
| `AccountRequestController.java` | REST endpoints - submit, list, cancel (user-facing); list, approve, reject (admin) |
| `AccountRequestService.java` | Business logic - validates submission, prevents duplicate pending requests, handles approve/reject/cancel transitions |
| `AccountRequest.java` | JPA entity - `user`, `type`, `status`, `reason`, `reviewNote`, `reviewedBy`, `createdAt` |
| `AccountRequestStatus.java` | Enum: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `AccountRequestType.java` | Enum: `UPGRADE_TO_ORGANIZER`, `UPGRADE_TO_VENDOR`, `REACTIVATE` |
| `AccountRequestMapper.java` | Entity → DTO mapping |

---

## State Machine

```
         submit()
PENDING ◀────────── (new request)
   │
   ├── approve()  →  APPROVED  (role assigned, user notified)
   ├── reject()   →  REJECTED  (review note recorded)
   └── cancel()   →  CANCELLED (user self-cancels while PENDING)
```

Rules enforced in `AccountRequestService`:
- Only one `PENDING` request of the same type per user at a time (`CONFLICT` error `AUTH-2001`)
- Only `PENDING` requests can be transitioned
- `cancel()` is only available to the request owner

---

## API Endpoints

### User-Facing

```
POST   /api/v1/account-requests               Submit a new request
GET    /api/v1/account-requests/me            List my own requests
DELETE /api/v1/account-requests/{id}          Cancel my pending request
POST   /api/v1/public/reactivation-requests   Public reactivation (no auth needed)
GET    /api/v1/public/reactivation-status     Check if email has pending reactivation
```

### Admin-Facing

```
GET    /api/v1/admin/account-requests                       List all (filter by status)
PUT    /api/v1/admin/account-requests/{id}/approve         Approve request
PUT    /api/v1/admin/account-requests/{id}/reject          Reject request
```

---

## Post-Approval Effects

When an admin **approves** a request:

- For `UPGRADE_TO_ORGANIZER` / `UPGRADE_TO_VENDOR`: the user's role is updated in `user_roles` table
- For `REACTIVATE`: the user's `active` flag is set to `true` and `deleted_at` is cleared
- A Kafka notification event is published to the Notification Service so the user receives an email/push confirmation

---

## Security

- All admin endpoints are `@PreAuthorize("hasRole('ADMIN')")`
- Users can only view/cancel their own requests
- Duplicate detection prevents spam submissions
- `reviewedBy` field records which admin took action for audit purposes
