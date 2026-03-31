[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 🔕 Notification Preferences

## Overview

EventZen gives every user full control over **which channels** (email, push, in-app, webhook) receive **which types** of notifications. Preferences are stored per user in MongoDB and checked at dispatch time - if a user has disabled email for `ticket.confirmed` events, that channel is silently skipped for that user without affecting delivery to other users or other channels.

---

## Preference Model

```js
// MongoDB document: notification_preferences
{
  userId: "uuid",
  email:   { enabled: true,  eventTypes: [] },      // [] = all types
  push:    { enabled: true,  eventTypes: ["ticket.confirmed"] },
  inApp:   { enabled: true,  eventTypes: [] },
  webhook: { enabled: false, eventTypes: [] }
}
```

### `eventTypes` semantics:
- **Empty array `[]`** → receive **all** event types on this channel (opt-in to everything)
- **Non-empty array** → receive **only** the listed event types
- **`enabled: false`** → this channel is completely disabled regardless of `eventTypes`

---

## Key Source Files

| File | Purpose |
|---|---|
| `preferenceService.js` | `getPreferences(userId)`, `updatePreferences(userId, payload)`, `isChannelEnabled(prefs, channel, eventType)` |
| `NotificationPreference.js` | Mongoose model |

---

## Preference Resolution Logic

```js
// isChannelEnabled() - called before every channel dispatch
const isChannelEnabled = (preferences, channel, eventType) => {
  const config = preferences?.[channelKey];     // e.g. preferences.email
  if (!config || config.enabled === false)
    return false;                               // channel disabled
  if (!config.eventTypes || config.eventTypes.length === 0)
    return true;                                // all types allowed
  return config.eventTypes.includes(eventType); // explicit allowlist
};
```

---

## Default Preferences

New users get **all channels enabled, all event types** by default - created via `upsert` on first preference check. This ensures no notifications are missed for new accounts before they configure their preferences.

```js
const defaultPreference = () => ({
  email:   { enabled: true, eventTypes: [] },
  push:    { enabled: true, eventTypes: [] },
  inApp:   { enabled: true, eventTypes: [] },
  webhook: { enabled: true, eventTypes: [] }
});
```

---

## API Endpoints

```
GET    /api/v1/notifications/preferences          Get current user's preferences
PUT    /api/v1/notifications/preferences          Update preferences (partial update supported)
```

**Example update payload:**

```json
{
  "push": { "enabled": true, "eventTypes": ["ticket.confirmed", "payment.succeeded"] },
  "email": { "enabled": false }
}
```

Only the keys present in the payload are updated; other channels remain unchanged (MongoDB `$set` semantics).

---

## Integration with Dispatch

The notification dispatcher calls `isChannelEnabled()` for every `(channel, eventType)` combination before invoking the channel provider:

```
For each channel in [EMAIL, PUSH, IN_APP, WEBHOOK]:
  Load user preferences
  if isChannelEnabled(prefs, channel, eventType):
    dispatch → channel provider
    log delivery attempt
```

This means one Kafka event can result in 0–4 channel deliveries depending on the user's settings.
