# EventZen - Novelty & Advanced Features

This directory documents the standout novelty features and the core advanced infrastructure technologies that power the EventZen platform.

---

## 🌟 Novelty Features

These are the original, non-trivial capabilities that go beyond standard CRUD and differentiate EventZen from a typical project.

| # | Feature | Description |
|---|---------|-------------|
| 1 | [MFA with TOTP](./novelty-mfa-totp.md) | Device-linked time-based one-time password multi-factor authentication |
| 2 | [QR Code Auto-Scanning from Video](./novelty-qr-video-scanning.md) | Real-time browser-based QR code detection from live camera feed for event check-in |
| 3 | [Real-Time Seat Updates](./novelty-realtime-seat-updates.md) | Live seat availability broadcast via WebSocket / SignalR so all users see the same seat map simultaneously |

---

## ⚙️ Advanced & Core Infrastructure Features

These technologies form the production-grade backbone of the platform - each integrated non-trivially and documented here with its architectural role.

| # | Feature | Description |
|---|---------|-------------|
| 1 | [HashiCorp Vault](./hashicorp-vault.md) | Zero-secret-at-rest secrets management with dynamic credential injection via Vault Agent |
| 2 | [Apache Kafka](./kafka.md) | Asynchronous event-driven inter-service communication and notification pipelines |
| 3 | [Redis](./redis.md) | Distributed caching and rate-limiting backing store |
| 4 | [Zookeeper](./zookeeper.md) | Kafka broker coordination and distributed consensus |
| 5 | [Prometheus & Grafana](./prometheus-grafana.md) | Metrics scraping, alerting, and visualization dashboards |
| 6 | [OpenTelemetry & Tempo](./opentelemetry-tempo.md) | Distributed tracing pipeline across all microservices |
| 7 | [Loki & Promtail](./loki-promtail.md) | Container log aggregation and querying |
| 8 | [MinIO](./minio.md) | S3-compatible object storage for ticket passes, invoices, and assets |
| 9 | [Razorpay](./razorpay.md) | Full payment lifecycle - order creation, browser modal, HMAC verification, webhooks |
| 10 | [OpenStreetMap (OSM)](./openstreetmap.md) | Embedded interactive venue maps without third-party API keys |
| 11 | [Firebase FCM](./firebase-fcm.md) | Browser and mobile push notification delivery via Firebase Cloud Messaging |
| 12 | [Nginx Reverse Proxy](./nginx.md) | API gateway, rate limiting, static OpenAPI docs aggregation, and SSL termination |
| 13 | [JWT & Refresh Token Rotation](./jwt-refresh-token.md) | Stateless authentication with HTTP-only cookie refresh token rotation |

---

## 🔐 Auth & Security Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | [Google OAuth Sign-In](./google-oauth.md) | Server-side Google ID token verification with account linking |
| 2 | [Field-Level Encryption](./field-level-encryption.md) | AES-256-GCM encryption of sensitive personal data fields at rest |
| 3 | [Audit Logging](./audit-logging.md) | Tamper-evident security audit trail of all auth and admin actions |
| 4 | [RBAC & Permissions System](./rbac-permissions.md) | DB-driven role-permission model with Spring Security method-level enforcement |
| 5 | [Password Reset Flow](./password-reset.md) | Secure tokenised email-based password reset with enumeration prevention |
| 6 | [Account Request & Approval](./account-request-approval.md) | Gated onboarding - vendors and organizers require admin approval before access |

---

## 🔔 Notification Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | [Notification Templates & Multi-Channel Delivery](./notification-templates.md) | Versioned Handlebars templates dispatched via email, push, in-app, or webhook |
| 2 | [Notification Preferences](./notification-preferences.md) | Per-user, per-channel, per-event-type delivery opt-in/opt-out |
| 3 | [Delivery Logging](./delivery-logging.md) | Per-attempt delivery audit trail with status, provider, and retry tracking |
| 4 | [Newsletter Subscriptions](./newsletter-subscriptions.md) | Opt-in newsletter with unsubscribe flow, separate from transactional mail |

---

## 💰 Finance Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | [Financial Reports & Budget Tracking](./financial-reports-budget.md) | Per-event budget creation, expense logging, revenue aggregation, and report generation |
| 2 | [Invoice & Ticket Pass Generation](./invoice-ticket-pass.md) | Auto-generated PDF invoices (Finance) and premium PDF ticket passes (Ticketing) stored in MinIO |
| 3 | [QR Code Generation](./qr-code-generation.md) | HMAC-signed SVG QR codes embedded in ticket PDFs for tamper-proof entry validation |
