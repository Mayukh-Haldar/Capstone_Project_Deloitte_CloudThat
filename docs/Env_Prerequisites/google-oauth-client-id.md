# Google OAuth Client ID

[Back to README section](../../README.md#env-file-example-and-prerequisites-for-hashi-corp-vault) | [Back to env overview](./OVERVIEW.md)

EventZen uses a Google web client ID for browser sign-in in the frontend and for token validation in the auth service.

## Variables covered

- `VITE_GOOGLE_CLIENT_ID`
- `AUTH_GOOGLE_CLIENT_ID`

Use the same web client ID value for both variables unless you intentionally separate environments.

## Step-by-step setup

Google's current guidance is to create a Google Cloud project, configure the Google Auth platform or OAuth consent flow, then create a **Web application** client and set the correct JavaScript origins.

### 1. Open the Google Cloud Console

Go to:

- https://console.cloud.google.com/

### 2. Select or create a project

1. Open the project picker in the top navigation bar.
2. Create a new project or select an existing one for EventZen.

### 3. Register the app for Google Auth

If prompted, complete the app registration or consent-screen setup flow before creating a client.

Recommended values for local development:

- App name: `EventZen`
- Audience: choose the option that fits your organization
- Test users: add the Google accounts you will use during development

### 4. Create the OAuth client

1. Open the **Clients** or **Credentials** area for Google Auth / OAuth.
2. Click **Create client**.
3. Choose **Web application** as the application type.
4. Give it a name such as `EventZen Web Local`.

### 5. Add authorized JavaScript origins

Google's web OAuth guide specifically notes that local testing should include both `http://localhost` and `http://localhost:<port_number>` as authorized JavaScript origins.

For this repository, add at least:

- `http://localhost`
- `http://localhost:5173`
- Your production frontend origin when available, for example `https://app.example.com`

### 6. Create the client and copy the client ID

After creating the client, copy the generated **Client ID**. It usually looks like:

```text
123456789012-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com
```

### 7. Add it to `.env`

```env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
AUTH_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

## Recommended checks

- The frontend origin in `.env` should match one of the origins configured in Google Cloud.
- If you change the app domain later, update the client configuration in Google Cloud first.
- If Google shows an unverified app warning, review the consent-screen audience, scopes, and branding settings in the Google Cloud Console.

## Official references

- Google OAuth client ID for web apps: https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid
- Google Cloud help for managing OAuth clients: https://support.google.com/cloud/answer/6158849?hl=en
