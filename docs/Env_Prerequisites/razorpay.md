# Razorpay Setup

[Back to README section](../../README.md#env-file-example-and-prerequisites-for-hashi-corp-vault) | [Back to env overview](./OVERVIEW.md)

EventZen's finance service uses Razorpay for payment order creation and payment verification.

## Variables covered

- `FINANCE_RAZORPAY_ENABLED`
- `FINANCE_RAZORPAY_KEY_ID`
- `FINANCE_RAZORPAY_KEY_SECRET`
- `FINANCE_RAZORPAY_CHECKOUT_NAME`
- `FINANCE_RAZORPAY_CHECKOUT_DESCRIPTION`

## Recommended local-development approach

Start with Razorpay **Test Mode** first. Razorpay's current dashboard guidance says you can generate test keys without adding website details, while live keys require verified website details.

## Step-by-step setup

### 1. Create or sign in to your Razorpay account

Open:

- https://dashboard.razorpay.com/

### 2. Switch to Test Mode

1. Log in to the Razorpay Dashboard.
2. Select **Test** mode from the dashboard mode selector.

### 3. Generate API keys

According to the current Razorpay dashboard documentation, the path is:

- **Account & Settings**
- **API Keys** under **Website and app settings**
- **Generate Key**

### 4. Copy the keys securely

Razorpay shows the key pair when generated, but the secret is not meant to remain visible later. Copy both values immediately and store them securely.

### 5. Add them to `.env`

```env
FINANCE_RAZORPAY_ENABLED=true
FINANCE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
FINANCE_RAZORPAY_KEY_SECRET=your-razorpay-key-secret
FINANCE_RAZORPAY_CHECKOUT_NAME=EventZen
FINANCE_RAZORPAY_CHECKOUT_DESCRIPTION="Event registration payment"
```

## Going live later

Razorpay's documentation notes that live keys usually require website details to be added and verified in the dashboard. When you move from test to live:

1. Verify your production website details in Razorpay.
2. Generate **Live Mode** keys.
3. Replace the test keys in your local secret store and deployment secrets.

## Practical notes

- Never expose `FINANCE_RAZORPAY_KEY_SECRET` in screenshots or commits.
- The frontend checkout branding text comes from `FINANCE_RAZORPAY_CHECKOUT_NAME` and `FINANCE_RAZORPAY_CHECKOUT_DESCRIPTION`.
- After updating keys, re-import them into the local Vault-backed secret store before rebuilding the stack.

## Official references

- Razorpay API keys guide: https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/
