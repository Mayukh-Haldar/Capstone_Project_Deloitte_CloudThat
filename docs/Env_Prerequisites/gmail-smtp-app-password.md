# Gmail SMTP App Password

[Back to README section](../../README.md#env-file-example-and-prerequisites-for-hashi-corp-vault) | [Back to env overview](./OVERVIEW.md)

EventZen uses SMTP settings for both auth emails and notification emails. A common local-development setup is Gmail SMTP with an app password.

## Variables covered

### Auth service

- `AUTH_SMTP_HOST`
- `AUTH_SMTP_PORT`
- `AUTH_SMTP_USERNAME`
- `AUTH_SMTP_PASSWORD`
- `AUTH_SMTP_AUTH`
- `AUTH_SMTP_STARTTLS`
- `AUTH_SMTP_CONNECTION_TIMEOUT`
- `AUTH_SMTP_TIMEOUT`
- `AUTH_SMTP_WRITE_TIMEOUT`
- `AUTH_MAIL_FROM_EMAIL`
- `AUTH_MAIL_FROM_NAME`

### Notification service

- `NOTIFICATION_SMTP_HOST`
- `NOTIFICATION_SMTP_PORT`
- `NOTIFICATION_SMTP_USERNAME`
- `NOTIFICATION_SMTP_PASSWORD`
- `NOTIFICATION_SMTP_AUTH`
- `NOTIFICATION_SMTP_STARTTLS`
- `NOTIFICATION_MAIL_FROM_EMAIL`
- `NOTIFICATION_MAIL_FROM_NAME`

## Before you start

Google currently allows app passwords only when the Google account has **2-Step Verification** turned on. Google also notes that app passwords are mainly for apps that do not support Sign in with Google.

## Step-by-step setup

### 1. Turn on 2-Step Verification

1. Open your Google Account security page.
2. Enable **2-Step Verification** if it is not already enabled.

### 2. Create an app password

1. Open the App Passwords page: https://myaccount.google.com/apppasswords
2. Sign in if prompted.
3. Create a new app password for EventZen mail delivery.
4. Copy the generated 16-character password immediately. Google only shows it once.

### 3. Fill the SMTP values in `.env`

```env
AUTH_SMTP_HOST=smtp.gmail.com
AUTH_SMTP_PORT=587
AUTH_SMTP_USERNAME=your-gmail-address@gmail.com
AUTH_SMTP_PASSWORD=your-16-character-app-password
AUTH_SMTP_AUTH=true
AUTH_SMTP_STARTTLS=true
AUTH_MAIL_FROM_EMAIL=your-gmail-address@gmail.com
AUTH_MAIL_FROM_NAME=EventZen

NOTIFICATION_SMTP_HOST=smtp.gmail.com
NOTIFICATION_SMTP_PORT=587
NOTIFICATION_SMTP_USERNAME=your-gmail-address@gmail.com
NOTIFICATION_SMTP_PASSWORD=your-16-character-app-password
NOTIFICATION_SMTP_AUTH=true
NOTIFICATION_SMTP_STARTTLS=true
NOTIFICATION_MAIL_FROM_EMAIL=your-gmail-address@gmail.com
NOTIFICATION_MAIL_FROM_NAME=EventZen
```

## Practical notes

- Port `587` with STARTTLS is the standard Gmail SMTP submission setup.
- You can reuse one mailbox for both auth and notification flows during development.
- If you change your Google account password, Google may revoke existing app passwords, so generate a new one and re-import it into the local secret store.
- Avoid using your primary personal mailbox in shared team environments.

## Official references

- Google app passwords help: https://support.google.com/accounts/answer/185833
