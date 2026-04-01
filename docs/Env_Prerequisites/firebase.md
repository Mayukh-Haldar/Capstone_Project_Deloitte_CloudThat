# Firebase Setup

[Back to README section](../../README.md#env-file-example-and-prerequisites-for-hashi-corp-vault) | [Back to env overview](./OVERVIEW.md)

EventZen uses Firebase in two different ways:

1. Frontend web app configuration for Firebase SDK initialization and browser push support.
2. Firebase Admin service-account credentials for the notification service.

## Variables covered

### Frontend web app

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY`

### Notification service

- `NOTIFICATION_FIREBASE_PROJECT_ID`
- `NOTIFICATION_FIREBASE_CLIENT_EMAIL`
- `NOTIFICATION_FIREBASE_PRIVATE_KEY`

## Part 1: Create the Firebase project and web app

According to Firebase's current web setup guide, you first create a Firebase project, then register a web app, and Firebase gives you a configuration object for the SDK.

### Steps

1. Open the Firebase console: https://console.firebase.google.com/
2. Click **Create a project**.
3. Enter a project name and finish the project creation flow.
4. Open the project overview page.
5. Click the **Web** app icon to register a web app.
6. Enter an app nickname such as `eventzen-web`.
7. Click **Register app**.
8. Copy the Firebase config object shown by the console.

## Map the Firebase web config to `.env`

| Firebase console value | EventZen env variable |
|---|---|
| `apiKey` | `VITE_FIREBASE_API_KEY` |
| `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `VITE_FIREBASE_PROJECT_ID` |
| `storageBucket` | `VITE_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
| `appId` | `VITE_FIREBASE_APP_ID` |

## Part 2: Generate the FCM VAPID key for browser push

Firebase's FCM web guide says to open **Cloud Messaging** in project settings and use the **Web Push certificates** area to generate a key pair.

### Steps

1. In the Firebase console, open your project.
2. Go to **Project settings**.
3. Open the **Cloud Messaging** tab.
4. Scroll to the **Web configuration** section.
5. In **Web Push certificates**, click **Generate Key Pair**.
6. Copy the generated public key.
7. Set that public key as `VITE_FIREBASE_VAPID_KEY`.

## Part 3: Generate the Firebase Admin service-account credentials

Firebase's Admin SDK setup guide says to open **Settings > Service accounts** and generate a new private key.

### Steps

1. In the Firebase console, open your project.
2. Go to **Project settings**.
3. Open the **Service accounts** tab.
4. Click **Generate new private key**.
5. Confirm and download the JSON file.
6. Open the JSON file locally.
7. Copy these values into `.env`:

| JSON field | EventZen env variable |
|---|---|
| `project_id` | `NOTIFICATION_FIREBASE_PROJECT_ID` |
| `client_email` | `NOTIFICATION_FIREBASE_CLIENT_EMAIL` |
| `private_key` | `NOTIFICATION_FIREBASE_PRIVATE_KEY` |

## How to store the private key in `.env`

Keep the full private key in one quoted line with escaped newline characters:

```env
NOTIFICATION_FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Practical checks

- The project ID used in the frontend values and notification-service values should match.
- The web app and the service account should belong to the same Firebase project unless you intentionally separate environments.
- After updating Firebase secrets, re-import them into the local Vault-backed secret store.

## Official references

- Firebase web setup: https://firebase.google.com/docs/web/setup
- Firebase Cloud Messaging for web: https://firebase.google.com/docs/cloud-messaging/js/client
- Firebase Admin SDK setup: https://firebase.google.com/docs/admin/setup
