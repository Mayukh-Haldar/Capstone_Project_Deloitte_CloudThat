[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 🔔 Firebase FCM

**Role:** Browser & Mobile Push Notifications  
**Category:** Advanced Infrastructure

---

## Overview

EventZen uses **Firebase Cloud Messaging (FCM)** via the **Firebase Admin SDK** to deliver push notifications to users' browsers and mobile devices. Users can register their device token from the frontend, and the Notification Service dispatches push messages through FCM whenever a relevant event occurs.

---

## Flow

```
1. User visits EventZen in browser (or installs PWA)
       │
       ▼
2. Browser requests push notification permission
       │
       ▼
3. Firebase SDK generates a device FCM token
       │
       ▼
4. Frontend POSTs token to Notification Service
   POST /api/push-tokens  { token, deviceInfo }
       │
       ▼
5. Token stored in PushToken collection (MongoDB)
       │
       ▼
6. Domain event occurs (e.g., event updated, payment confirmed)
       │  Kafka message
       ▼
7. Notification Service kafkaConsumerService.js routes to pushProvider.js
       │
       ▼
8. pushProvider.js calls Firebase Admin SDK
   admin.messaging().send({ token, notification: { title, body } })
       │
       ▼
9. FCM delivers push to user's browser / device
```

---

## Key Files

| File | Role |
|------|------|
| `notification-service/src/providers/pushProvider.js` | Firebase Admin SDK initialization and message dispatch |
| `notification-service/src/routes/pushToken.routes.js` | Token registration / deregistration endpoints |
| `notification-service/src/models/PushToken.js` | MongoDB model for device tokens |
| `frontend/src/components/PushNotificationBootstrap.jsx` | Frontend Firebase SDK init, token request, registration |

---

## Configuration

| Parameter | Source |
|-----------|--------|
| Firebase service account JSON | HashiCorp Vault → injected as env var |
| Firebase project ID | Vault secret |
| VAPID key (browser push) | Vault secret |

---

## Token Lifecycle

- Tokens are stored per-user per-device in MongoDB
- On token refresh (FCM rotates tokens periodically), the frontend re-registers the new token
- Deregistration removes the token on logout or when the user disables push in preferences
- Invalid / expired tokens returned by FCM are automatically cleaned up
