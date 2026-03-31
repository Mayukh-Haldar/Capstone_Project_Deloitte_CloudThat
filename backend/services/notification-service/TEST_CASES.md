# Notification Service Test Cases

Grand total: **64 automated tests** + **26 Postman system tests** = **90 tests**

---

## Smoke Tests (`tests/app.test.js`)

| ID | File | Scenario | Expected Result |
| --- | --- | --- | --- |
| NTF-SM-001 | app.test.js | `GET /api/v1/health` returns service status | HTTP 200, `status: "UP"` |
| NTF-SM-002 | app.test.js | Unknown route returns EventZen-style 404 | HTTP 404, `error: "NOT_FOUND"`, `traceId` present |

---

## Unit Tests

### Template Renderer (`tests/unit/templateRenderer.test.js`, `templateRenderer.extended.test.js`)

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-UT-001 | Render subject/body/html with Handlebars variables | Variables interpolate correctly into all fields |
| NTF-UT-023 | Template with `html: null` returns `null` html | `result.html === null` |
| NTF-UT-024 | Static template with empty variable map | Content rendered verbatim |
| NTF-UT-025 | `{{uppercase eventType}}` helper | Result uppercased |
| NTF-UT-026 | Missing variable placeholder | Renders as empty string |

### Preference Service (`tests/unit/preference.service.test.js`, `preferenceService.extended.test.js`)

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-UT-002 | Globally disabled channel | `isChannelEnabled` returns `false` |
| NTF-UT-003 | Allow-list permits only matching event types | Matching → `true`, others → `false` |
| NTF-UT-027 | Unknown channel key (e.g. SMS) | Returns `true` (permissive default) |
| NTF-UT-028 | `null` preferences object | Returns `true` |
| NTF-UT-029 | Empty `eventTypes` list with channel enabled | Returns `true` (allow all) |
| NTF-UT-030 | Event not in allow-list | Returns `false`; event in list → `true` |

### Kafka Consumer Service (`tests/unit/kafkaConsumerService.test.js`)

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-UT-K01 | `normalizeKafkaEvent` maps topic + JSON payload | correlationId, eventType, recipients, metadata mapped correctly |

### HMAC Signature (`tests/unit/signature.test.js`)

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-UT-004 | `createSignature` produces `sha256=` prefixed 71-char string | Format correct |
| NTF-UT-005 | Same inputs produce identical digest | Deterministic |
| NTF-UT-006 | Output matches manual `crypto.createHmac` computation | Correct algorithm applied |
| NTF-UT-007 | Different secrets → different digests | Cryptographically distinct |

### Pagination (`tests/unit/pagination.test.js`)

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-UT-008 | Empty query uses defaults: page=0, size=20 | skip=0 |
| NTF-UT-009 | Explicit page=2 size=10 → skip=20 | Computed correctly |
| NTF-UT-010 | size=500 clamped to 100 | Max enforced |
| NTF-UT-011 | page=-3 clamped to 0 | Min enforced |
| NTF-UT-012 | `buildPage` with 45 elements / size 20 → 3 pages | Ceiling division correct |
| NTF-UT-013 | `buildPage` with 0 elements → 0 pages | Zero-result edge case |

### ApiError (`tests/unit/apiError.test.js`)

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-UT-014 | Constructor sets status, error, code, message | All fields accessible |
| NTF-UT-015 | Details array stored | `err.details` matches input |
| NTF-UT-016 | `instanceof Error` check | Extends Error correctly |

### Auth Middleware (`tests/unit/auth.middleware.test.js`)

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-UT-017 | `normalizeRole` strips `ROLE_` prefix and uppercases | `"ROLE_ADMIN"` → `"ADMIN"` |
| NTF-UT-018 | `normalizeRole` with falsy input | Returns `null` |
| NTF-UT-019 | `normalizeRole` lowercased input | Returns uppercase |
| NTF-UT-020 | `extractRoles` reads from `roles` claim array | Returns clean role list |
| NTF-UT-021 | `extractRoles` falls back to `authorities` array | Strips prefix, returns roles |
| NTF-UT-022 | `extractRoles` with missing/invalid claims | Returns `[]` |

---

## Integration Tests

### Existing Notification Integration (`tests/integration/notification.integration.test.js`)

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-IT-001 | Internal trigger sends `registration.confirmed` | Notification records created for EMAIL + IN_APP channels |
| NTF-IT-002 | Authenticated attendee lists own inbox | Paginated response, `totalElements >= 2` |
| NTF-IT-003 | Attendee marks a notification as read | `status: "READ"`, `readAt` set |
| NTF-IT-004 | Admin fetches delivery logs | Paginated `content` array returned |

### Template Management (`tests/integration/template.integration.test.js`)

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-IT-006 | Admin lists templates - initially empty | HTTP 200, empty array |
| NTF-IT-007 | Admin creates a template | HTTP 201, `templateKey` and `_id` present |
| NTF-IT-008 | Admin updates template subject | HTTP 200, updated subject, 2 versions |
| NTF-IT-009 | Admin previews template with variables | HTTP 200, rendered `subject` contains variable value |
| NTF-IT-010 | Non-admin cannot create a template | HTTP 403, `AUTHORIZATION_ERROR` |
| NTF-IT-011 | Created template appears in subsequent list | HTTP 200, array length 1 |

### Notification Preferences (`tests/integration/preference.integration.test.js`)

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-IT-012 | Get preferences creates defaults for new user | HTTP 200, all channels enabled |
| NTF-IT-013 | User mutes email channel | HTTP 200, `email.enabled: false` |
| NTF-IT-014 | Muted preference persists on re-fetch | HTTP 200, `email.enabled` still `false` |
| NTF-IT-015 | Unauthenticated request returns 401 | HTTP 401, `AUTHENTICATION_ERROR` |

### Push Tokens (`tests/integration/pushToken.integration.test.js`)

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-IT-016 | User registers a push token | HTTP 201, `isActive: true` |
| NTF-IT-017 | User lists active push tokens | HTTP 200, token appears in array |
| NTF-IT-018 | User deactivates push token | HTTP 204 |
| NTF-IT-019 | Deactivated token absent from active list | HTTP 200, empty array |

### Webhook Subscriptions (`tests/integration/webhook.integration.test.js`)

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-IT-020 | Admin creates webhook subscription | HTTP 201, `eventType` and `_id` present |
| NTF-IT-021 | Admin lists subscriptions | HTTP 200, array contains created entry |
| NTF-IT-022 | Admin deletes subscription | HTTP 204 |
| NTF-IT-023 | Deleted subscription absent from list | HTTP 200, empty array |
| NTF-IT-024 | Attendee cannot create webhook | HTTP 403, `AUTHORIZATION_ERROR` |

### Notification Management (`tests/integration/notification.management.integration.test.js`)

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-IT-025 | Owner retrieves single notification by ID | HTTP 200, `_id` matches, `deliveryLogs` present |
| NTF-IT-026 | Different user cannot access notification | HTTP 403, `AUTHORIZATION_ERROR` |
| NTF-IT-027 | Admin can access any notification | HTTP 200 |
| NTF-IT-028 | Inbox filtered by `channel=IN_APP` | HTTP 200, all items are `IN_APP` |
| NTF-IT-029 | `unreadOnly=true` excludes `READ` notifications | HTTP 200, no `READ` status in content |
| NTF-IT-030 | Owner soft-deletes own notification | HTTP 204; notification absent from inbox |
| NTF-IT-031 | Unauthenticated inbox request returns 401 | HTTP 401, `AUTHENTICATION_ERROR` |

### Newsletter Subscription (`tests/integration/newsletter.integration.test.js`)

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-IT-032 | New subscriber receives success message | HTTP 200, `message` contains "subscribed" |
| NTF-IT-033 | Duplicate subscription returns graceful 200 without re-sending email | HTTP 200, `message` contains "already" |
| NTF-IT-034 | Invalid email address returns 400 validation error | HTTP 400, `error: "VALIDATION_ERROR"` |

---

## System Tests - Postman (`postman/NotificationService.postman_collection.json`)

Run with:
```bash
npm run test:system:postman
```

### Setup & Health

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-ST-001 | Health check | HTTP 200, `status: "UP"` |

### Notifications

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-ST-002 | Internal trigger - send IN_APP notification | HTTP 202, `notifications` array populated, `notificationId` captured |
| NTF-ST-003 | Attendee lists own inbox | HTTP 200, paginated response, `totalElements >= 1` |
| NTF-ST-004 | Attendee retrieves single notification | HTTP 200, `_id` matches, `deliveryLogs` array present |
| NTF-ST-005 | Attendee marks notification as read | HTTP 200, `status: "READ"`, `readAt` set |
| NTF-ST-006 | Inbox filtered by `channel=IN_APP` | HTTP 200, all items are `IN_APP` channel |
| NTF-ST-007 | Attendee soft-deletes notification | HTTP 204 |
| NTF-ST-008 | Missing internal service key on send endpoint | HTTP 403, `AUTHORIZATION_ERROR` |
| NTF-ST-009 | Admin lists delivery logs | HTTP 200, paginated `content` array |
| NTF-ST-010 | Non-admin cannot access delivery logs | HTTP 403 |

### Notification Templates

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-ST-011 | Admin creates a notification template | HTTP 201, `templateKey` stored, `templateId` captured |
| NTF-ST-012 | Admin lists templates after creation | HTTP 200, at least one item |
| NTF-ST-013 | Admin updates template subject | HTTP 200, subject updated, version history has ≥ 2 entries |
| NTF-ST-014 | Admin previews template with variables | HTTP 200, rendered `subject` contains variable value |
| NTF-ST-015 | Non-admin cannot create a template | HTTP 403, `AUTHORIZATION_ERROR` |

### Preferences

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-ST-016 | Get default preferences for user | HTTP 200, `email`, `push`, `inApp` objects present |
| NTF-ST-017 | Update preferences - mute email, restrict push | HTTP 200, `email.enabled: false` |
| NTF-ST-018 | Re-fetch - muted preference persists | HTTP 200, `email.enabled` still `false` |

### Push Tokens

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-ST-019 | Register push token | HTTP 201, `isActive: true` |
| NTF-ST-020 | List active push tokens | HTTP 200, registered token in list |
| NTF-ST-021 | Deactivate push token | HTTP 204 |

### Webhook Subscriptions

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-ST-022 | Admin creates webhook subscription | HTTP 201, `eventType` and `_id` present |
| NTF-ST-023 | Admin lists webhook subscriptions | HTTP 200, subscription in list |
| NTF-ST-024 | Admin deletes webhook subscription | HTTP 204 |

### Newsletter

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NTF-ST-025 | New subscriber receives success message | HTTP 200, `message` string present |
| NTF-ST-026 | Duplicate subscription returns graceful 200 | HTTP 200, "already subscribed" message |

---

## Test Counts Summary

| Type | Count |
| --- | --- |
| Smoke (Node.js built-in) | 2 |
| Unit (Node.js built-in, pure) | 31 |
| Integration (Node.js + supertest + MongoDB Memory Server) | 31 |
| **Total automated** | **64** |
| System / Postman (newman) | 26 |
| **Grand total** | **90** |

