[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 📨 Notification Templates & Multi-Channel Delivery

## Overview

EventZen's **Notification Service** (Node.js + MongoDB) uses a fully template-driven, multi-channel notification engine. Rather than hard-coding email or push message text in application code, all notification content is stored as **versioned templates** in MongoDB, rendered with **Handlebars** at dispatch time, and delivered through pluggable **channel providers** (email via SMTP, push via Firebase FCM).

---

## Architecture

```
Auth / Event / Finance / Ticketing
Service  (Kafka producer)
         │
         ▼  Kafka topic: notification.dispatch
    Notification Service (Node.js)
         │
         ├── templateService.js  ──▶  MongoDB (NotificationTemplate)
         │   Resolve template by eventType + channel + locale
         │   Render Handlebars body/subject with variables
         │
         ├── preferenceService.js  ──▶  MongoDB (NotificationPreference)
         │   Check if user has enabled this channel for this eventType
         │
         ├── channels/email  ──▶  emailProvider.js  ──▶  SMTP / SendGrid
         ├── channels/push   ──▶  pushProvider.js   ──▶  Firebase FCM
         └── deliveryLogService.js  ──▶  MongoDB (DeliveryLog)
```

---

## Template Model

Each template document contains:

```js
{
  templateKey: "ticket.confirmed.email.en",
  eventType:   "ticket.confirmed",       // Kafka event type
  channel:     "EMAIL",                  // EMAIL | PUSH | IN_APP | WEBHOOK
  locale:      "en",
  subject:     "Your ticket for {{eventTitle}} is confirmed!",
  body:        "Hi {{firstName}}, your ticket #{{ticketNumber}} is ready.",
  html:        "<p>Hi {{firstName}}, ...</p>",
  variables:   ["firstName", "eventTitle", "ticketNumber"],
  isActive:    true,
  versions: [
    { version: 1, subject: "...", body: "...", updatedBy: "admin-uuid" }
  ]
}
```

**Versioning** - every `updateTemplate()` call appends a new entry to the `versions` array, preserving the full edit history.

**Locale fallback** - `getTemplateForEvent()` first queries `locale: req.locale`, then falls back to `locale: "en"` automatically.

---

## Key Source Files

| File | Purpose |
|---|---|
| `templateService.js` | CRUD + resolve logic: `getTemplateForEvent`, `createTemplate`, `updateTemplate`, `previewTemplate` |
| `NotificationTemplate.js` | Mongoose model - schema with versioned history array |
| `templateRenderer.js` | Handlebars compilation and rendering with injected variables |
| `emailProvider.js` | SMTP / provider adapter - formats and sends email |
| `pushProvider.js` | Firebase FCM adapter - sends push notification |
| `channels.js` | Channel dispatcher - routes rendered notification to the right provider |

---

## Channel Types

| Channel | Provider | Notes |
|---|---|---|
| `EMAIL` | SMTP (JavaMail-compatible) | HTML + plain text bodies |
| `PUSH` | Firebase FCM | Title + body + metadata |
| `IN_APP` | MongoDB store | Retrieved on next app load |
| `WEBHOOK` | HTTP POST | Signed outbound payload |

---

## Template Preview API

Admins can preview a rendered template before deploying it:

```
POST /api/v1/templates/{id}/preview
{
  "variables": { "firstName": "Alice", "eventTitle": "AI Summit" }
}
```

Returns rendered `subject`, `body`, and `html` with test variables substituted.

---

## Supported Event Types (Examples)

| Kafka Event Type | Trigger |
|---|---|
| `ticket.confirmed` | Ticket booking confirmed |
| `payment.succeeded` | Payment captured |
| `account.approved` | Account request approved |
| `event.published` | New event published |
| `password.reset` | Password reset requested |
| `venue.booking.confirmed` | Venue reservation confirmed |
