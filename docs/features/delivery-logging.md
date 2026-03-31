[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 📝 Delivery Logging

## Overview

Every outbound notification dispatched by the Notification Service is recorded as a **Delivery Log** entry in MongoDB. This gives administrators a queryable, per-notification audit trail of exactly what was sent, to which user, via which channel and provider, whether it succeeded or failed, and on which attempt - enabling support investigations, retry analysis, and SLA reporting.

---

## Delivery Log Model

```js
// MongoDB document: delivery_logs
{
  notificationId:  "uuid",          // Internal notification ID
  correlationId:   "uuid",          // Kafka message correlation ID
  userId:          "uuid",          // Recipient user
  eventType:       "ticket.confirmed",
  channel:         "EMAIL",         // EMAIL | PUSH | IN_APP | WEBHOOK
  provider:        "smtp",          // smtp | fcm | internal | http
  status:          "DELIVERED",     // DELIVERED | FAILED | RETRYING
  responseCode:    200,             // HTTP/provider response code
  responseMessage: "OK",            // Provider message / error string
  attemptNumber:   1,               // Which retry attempt (1-indexed)
  metadata:        { ... },         // Extra provider-specific data
  createdAt:       "2026-03-31T...",
  updatedAt:       "2026-03-31T..."
}
```

---

## Key Source Files

| File | Purpose |
|---|---|
| `DeliveryLog.js` | Mongoose model - full schema above |
| `deliveryLogService.js` | `createDeliveryLog({...})` - single write operation |

---

## When Logs Are Written

A delivery log is written **immediately after each channel dispatch attempt**, whether it succeeds or fails:

```
Dispatch email for ticket.confirmed
  ├── SMTP send succeeds → log { status: "DELIVERED", responseCode: 200, attemptNumber: 1 }
  └── SMTP send fails   → log { status: "FAILED",    responseCode: 500, responseMessage: "Connection refused", attemptNumber: 1 }
                           → retry
                           → log { status: "DELIVERED", responseCode: 200, attemptNumber: 2 }
```

---

## Delivery Status Values

| Status | Meaning |
|---|---|
| `DELIVERED` | Provider accepted the message |
| `FAILED` | All attempts exhausted; message not delivered |
| `RETRYING` | Attempt failed but retry is queued |
| `SKIPPED` | User preference check blocked delivery |

---

## Admin API

```
GET /api/v1/admin/delivery-logs?userId={id}&channel={ch}&status={st}&page=0&size=20
GET /api/v1/admin/delivery-logs/{notificationId}
```

Returns paginated delivery log entries for support investigation and debugging.

---

## Value for Operations

- **Failed delivery investigation** - support can look up exactly why a user didn't receive their ticket email
- **Provider health monitoring** - rising `FAILED` rates on a channel indicate provider issues before users complain
- **Retry auditing** - `attemptNumber > 1` entries show which messages required retries and how many
- **Compliance** - demonstrates due diligence in delivery attempts for regulated communications
