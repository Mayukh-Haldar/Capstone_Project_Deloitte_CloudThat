[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 💳 Razorpay

**Role:** Payment Gateway  
**Category:** Advanced Infrastructure

---

## Overview

EventZen integrates **Razorpay** for a complete, production-grade payment lifecycle. The integration covers the full flow from order creation on the backend, through the browser-rendered payment modal, to cryptographic signature verification and webhook-based confirmation - matching real-world payment integration requirements.

---

## Payment Lifecycle

```
1. Customer clicks "Pay"
       │
       ▼
2. Finance Service creates Razorpay Order
   (POST /v1/orders via Razorpay SDK)
   → returns { order_id, amount, currency }
       │
       ▼
3. Frontend opens Razorpay Checkout Modal
   (Razorpay.js loaded client-side)
   → customer enters card / UPI / wallet
       │
       ▼
4. Razorpay returns payment response to frontend
   { razorpay_order_id, razorpay_payment_id, razorpay_signature }
       │
       ▼
5. Frontend POSTs all three fields to Finance Service
       │
       ▼
6. Finance Service verifies HMAC-SHA256 signature
   HMAC(key_secret, order_id + "|" + payment_id) == signature
       │
   ✅ Valid → mark payment successful, confirm registration
   ❌ Invalid → reject, do not fulfill order
       │
       ▼
7. Razorpay fires Webhook → Finance Service
   (payment.captured event - secondary confirmation)
   → Finance Service verifies webhook signature header
   → Updates payment record status
```

---

## Key Files

| File | Role |
|------|------|
| `finance-service/.../service/PaymentService.java` | Order creation, signature verification, webhook handling |
| `finance-service/.../controller/PaymentController.java` | REST endpoints for order creation, verification, webhook |
| `frontend/src/pages/EventCheckout.jsx` | Razorpay.js modal integration |

---

## Security Notes

- The `key_secret` is never exposed to the frontend - only `key_id` is sent to the browser
- All signature verification happens server-side
- Webhook endpoint validates `X-Razorpay-Signature` header before processing
- Credentials are injected via HashiCorp Vault, never hardcoded
