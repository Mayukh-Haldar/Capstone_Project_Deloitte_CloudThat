[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 📰 Newsletter Subscriptions

## Overview

EventZen includes a lightweight **opt-in newsletter subscription** system in the Notification Service. Visitors and users can subscribe to platform updates, new event announcements, and promotions using just their email address - no account required. The system enforces uniqueness per email, provides a clean unsubscribe flow, and keeps the newsletter list entirely separate from the transactional notification system.

---

## How It Works

```
User fills in email on landing page
         │
         ▼
POST /api/v1/newsletter/subscribe  { email: "user@example.com" }
         │
         ▼
NewsletterSubscriber.create() ── Mongoose upsert / unique check
         │
         ▼
Email added to newsletters collection
         │
         ▼
Confirmation email sent (optional SMTP template)
```

---

## Data Model

```js
// MongoDB document: newslettersubscribers
{
  email:     "user@example.com",   // unique, lowercase, trimmed
  createdAt: "2026-03-31T...",
  updatedAt: "2026-03-31T..."
}
```

The schema uses `unique: true` at the Mongoose level, and MongoDB enforces uniqueness at the index level - duplicate subscribe requests return a `409 CONFLICT` rather than creating duplicate records.

---

## Key Source Files

| File | Purpose |
|---|---|
| `NewsletterSubscriber.js` | Mongoose model - `email` (unique, lowercase, trimmed), timestamps |
| `newsletter.js` | Router - subscribe and unsubscribe endpoints |

---

## API Endpoints

```
POST   /api/v1/newsletter/subscribe     Subscribe an email
DELETE /api/v1/newsletter/unsubscribe   Remove subscription (email in body or query param)
```

**Subscribe request:**
```json
{ "email": "user@example.com" }
```

**Unsubscribe request:**
```json
{ "email": "user@example.com" }
```

---

## Design Notes

- **No auth required** - anyone with an email can subscribe or unsubscribe, consistent with email marketing norms
- **Lowercase + trim normalization** - applied by Mongoose schema before storage; prevents duplicate subscriptions from capitalisation differences
- **Separated from transactional mail** - newsletter subscribers are a distinct collection from `UserNotificationPreference`; unsubscribing from newsletters does not affect transactional notifications (booking confirmations, etc.)
- **GDPR-friendly** - unsubscribe removes the record entirely (not just a flag), so no personal data is retained after opt-out
