<h1 align="center">EventZen</h1>

<p align="center">
  <strong>A production-grade, polyglot microservices platform for end-to-end event management</strong>
  <br/>
  <em>Built as a Deloitte x CloudThat Capstone Project</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 18"/>
  <img src="https://img.shields.io/badge/Vite-6.3-B73BFE?style=flat-square&logo=vite&logoColor=white" alt="Vite 6"/>
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Spring_Boot-3.2-6DB33F?style=flat-square&logo=springboot&logoColor=white" alt="Spring Boot"/>
  <img src="https://img.shields.io/badge/.NET-10-512BD4?style=flat-square&logo=dotnet&logoColor=white" alt=".NET 10"/>
  <img src="https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker"/>
  <img src="https://img.shields.io/badge/Kafka-Confluent-231F20?style=flat-square&logo=apachekafka&logoColor=white" alt="Kafka"/>
  <img src="https://img.shields.io/badge/Vault-HashiCorp-FFEC6E?style=flat-square&logo=vault&logoColor=black" alt="Vault"/>
  <img src="https://img.shields.io/badge/Razorpay-Payment-0C2451?style=flat-square&logo=razorpay&logoColor=white" alt="Razorpay"/>
  <img src="https://img.shields.io/badge/MinIO-Object_Storage-C72E49?style=flat-square&logo=minio&logoColor=white" alt="MinIO"/>
  <img src="https://img.shields.io/badge/Prometheus-E6522C?style=flat-square&logo=prometheus&logoColor=white" alt="Prometheus"/>
  <img src="https://img.shields.io/badge/Grafana-F46800?style=flat-square&logo=grafana&logoColor=white" alt="Grafana"/>
</p>

---

## 📑 Table of Contents

- [🌟 Project Overview](#-project-overview)
- [🏗 Architecture](#-architecture)
- [💻 Tech Stack](#-tech-stack)
- [🧩 Microservices Breakdown](#-microservices-breakdown)
- [🔌 API Reference](#-api-reference)
- [✨ Features](#-features)
- [🗄 Database Schema](#-database-schema)
- [🔐 Security Implementation](#-security-implementation)
- [📨 Event-Driven Architecture (Kafka)](#-event-driven-architecture-kafka)
- [📊 Monitoring & Observability](#-monitoring--observability)
- [🗺 Diagrams & Design Documentation](#-diagrams--design-documentation)
- [📂 Project Structure](#-project-structure)
- [🚀 Getting Started](#-getting-started)
- [🧪 Testing](#-testing)
- [🌐 Access Points](#-access-points)
- [📄 License](#-license)

---

## 🌟 Project Overview

**EventZen** is a fully featured, scalable event management platform built for three distinct user roles:

| Role | Capabilities |
|------|-------------|
| **Admins** | Manage users, venues, vendors, budgets, events · Approve/reject requests · View financial analytics · Platform-wide oversight |
| **Vendors / Organizers** | Create & manage events end-to-end · Book venues · Hire vendors · Configure ticket types · Run live QR check-ins · Track budgets |
| **Customers / Attendees** | Browse & discover events · Register and pay for tickets · Manage QR-coded digital ticket wallet · Configure notification preferences |

The platform is built as a set of independently deployable **polyglot microservices** — combining **Java (Spring Boot 3.2)**, **C# (.NET 10)**, and **Node.js (Express)** for backend services — all containerized via **Docker Compose**, fronted by an **Nginx API Gateway**, secured by **HashiCorp Vault** for zero-secret-at-rest credential management, and interconnected through **Apache Kafka** for asynchronous event-driven communication.

**Repository:** [github.com/Mayukh-Haldar/Capstone_Project_Deloitte_CloudThat](https://github.com/Mayukh-Haldar/Capstone_Project_Deloitte_CloudThat) · Branch: `EXPORT_GITHUB_DOCKER`

---

## 🏗 Architecture

EventZen follows a microservices architecture with an Nginx API Gateway pattern, event-driven Kafka messaging, distributed tracing via OpenTelemetry, and secrets management via HashiCorp Vault.

```
┌────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React 18 SPA)                         │
│         Vite 6 + Tailwind CSS 4 + React Router 7 + Sonner          │
│         React Hook Form + Zod + Radix UI + Framer Motion            │
│                   Nginx (Production Container)                      │
└──────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP / REST
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                   API GATEWAY (Nginx)                               │
│  Reverse Proxy │ Load Balancing │ CORS │ Rate Limiting              │
│  Swagger UI Aggregation │ SPA Routing │ TLS (Production)            │
└────┬──────┬──────┬──────┬──────┬──────┬──────────────────────────┘
     │      │      │      │      │      │
     ▼      ▼      ▼      ▼      ▼      ▼
┌───────┐┌──────┐┌──────┐┌──────┐┌──────┐┌───────────────┐
│ Auth  ││Event ││Venue-││Ticket││Finance││ Notification  │
│Service││Svc   ││Vendor││ing   ││Service││   Service     │
│SB 3.2 ││SB 3.2││Node  ││.NET10││SB 3.2 ││   Node.js     │
│ :8081 ││:8082 ││:8083 ││:8084 ││:8085  ││    :8086      │
└───┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬────┘└──────┬────────┘
    │        │       │       │       │             │
    ▼        ▼       ▼       ▼       ▼             ▼
┌──────────────────────────────────────────────────────────┐
│                  DATA & INFRASTRUCTURE                    │
│                                                          │
│  MySQL (Auth)    MySQL (Events)    MySQL (Finance)        │
│  MySQL (Venue)   MySQL (Ticketing)  MongoDB (Notifications│
│                                                          │
│  Apache Kafka    HashiCorp Vault    MinIO Object Storage  │
│  Prometheus      Grafana            Loki + Promtail       │
│  Tempo (Traces)  OpenTelemetry      Firebase (FCM)        │
│  Razorpay        Nginx Prod Config  EC2 Autoscaler        │
└──────────────────────────────────────────────────────────┘
```

### Architecture Diagram (Mermaid)

```mermaid
flowchart TB
    subgraph FRONTEND
        A[React 18 SPA / Vite 6]
    end

    A --> NGINX[Nginx API Gateway / Load Balancer]

    subgraph BACKEND_SERVICES
        AUTH[Auth Service - Spring Boot 3.2]
        EV[Event Service - Spring Boot 3.2]
        TIC[Ticketing Service - .NET 10]
        VEN[Venue & Vendor - Node.js]
        FIN[Finance - Spring Boot 3.2]
        NOT[Notification - Node.js]
    end

    NGINX --> AUTH
    NGINX --> EV
    NGINX --> TIC
    NGINX --> VEN
    NGINX --> FIN
    NGINX --> NOT

    subgraph EVENT_BUS
        KAFKA[(Apache Kafka)]
    end

    subgraph INFRA
        VAULT[HashiCorp Vault]
        MINIO[MinIO Storage]
        MONITOR[Prometheus / Grafana / Loki / Tempo]
    end

    EV --> KAFKA
    FIN --> KAFKA
    TIC --> KAFKA
    KAFKA --> NOT
    FIN --> TIC

    AUTH -.-> VAULT
    EV -.-> MINIO
    FIN -.-> MINIO
```

---

## 💻 Tech Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.3.1 | UI framework with lazy loading & Suspense |
| Vite | 6.3.5 | Build tool & dev server |
| TypeScript | 5.8.2 | Type safety |
| Tailwind CSS | 4.1.12 | Utility-first styling |
| React Router | 7.13 | Client-side routing |
| React Hook Form | 7.55 | Form management |
| Zod | (via react-hook-form) | Runtime schema validation |
| Framer Motion | 12.38 | Animations & page transitions |
| Recharts | 3.8 | Data visualization & charts |
| Radix UI | Various | Accessible component primitives |
| Sonner | 2.0.3 | Toast notifications |
| jsPDF + html2canvas | Latest | PDF ticket export |
| jsQR | 1.4 | QR code scanning in browser |
| Firebase | 11.10 | FCM push notifications |
| Three.js | 0.183 | 3D background effects |
| Lucide React | 0.487 | Icon system |
| SignalR | 10.0 | Real-time WebSocket (seat hub) |
| next-themes | 0.4.6 | Dark/light mode |

### Backend Services

| Service | Language/Framework | Database | Port |
|---------|-------------------|----------|------|
| Auth Service | Java 21 / Spring Boot 3.2 | MySQL | 8081 |
| Event Service | Java 21 / Spring Boot 3.2 | MySQL | 8082 |
| Venue-Vendor Service | Node.js / Express | MySQL | 8083 |
| Ticketing Service | C# / .NET 10 / ASP.NET Core | MySQL | 8084 |
| Finance Service | Java 21 / Spring Boot 3.2 | MySQL | 8085 |
| Notification Service | Node.js / Express | MongoDB | 8086 |

### Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| API Gateway | Nginx | Reverse proxy, load balancing, CORS, Swagger aggregation |
| Message Broker | Apache Kafka (Docker) | Event-driven async communication |
| Object Storage | MinIO | Media uploads (venue/event images, invoice PDFs) |
| Secrets Management | HashiCorp Vault 1.17 | KV v2 with Vault Agent sidecar, zero `.env` at rest |
| Payment Gateway | Razorpay | Order creation, webhook verification, HMAC signing |
| Push Notifications | Firebase Cloud Messaging | Browser & mobile push delivery |
| Monitoring | Prometheus + Grafana | Metrics, dashboards, alerting |
| Logging | Loki + Promtail | Log aggregation across all containers |
| Distributed Tracing | Tempo + OpenTelemetry | Cross-service trace correlation |
| Orchestration | Docker Compose | Multi-container orchestration (two compose files) |
| Cloud Deployment | AWS EC2 | EC2 bootstrap, autoscaler, Nginx prod config scripts |

---

## 🧩 Microservices Breakdown

### 1. Auth Service (`backend/services/auth-service`)
> **Tech:** Java 21 · Spring Boot 3.2 · Spring Security · Spring Data JPA · MySQL

| Feature | Details |
|---------|---------|
| Registration | Email + password with OTP-based email verification (TOTP via `TotpService`) |
| Login | JWT access token + refresh token rotation with HTTP-only cookie storage |
| Google OAuth | `GoogleTokenInfoVerifier` validates Google ID tokens and auto-provisions accounts |
| Password Reset | Forgot → OTP email → Secure reset flow |
| User Management | Profile CRUD, email change with OTP re-verification, GDPR delete |
| Role System | `ADMIN` / `VENDOR` / `ORGANIZER` / `CUSTOMER` / `ATTENDEE` with role-based guards |
| MFA | TOTP-based MFA enrollment (`/auth/mfa/setup`, `/auth/mfa/verify`) |
| Account Request System | `VENDOR_ACCESS`, `DEACTIVATE`, `REACTIVATE`, `GDPR_DELETE` lifecycle requests with admin approval |
| PII Encryption | `FieldEncryptionService` — AES encryption for personally identifiable fields |
| Audit Logging | `AuditService` records sensitive operations with actor and timestamp |
| Data Seeder | `DataSeeder` bootstraps default admin, roles, and permissions on startup |
| Security | bcrypt hashing, Spring Security, JWT filter, `@ControllerAdvice` global error handler |
| Observability | Micrometer Prometheus at `/actuator/prometheus`, structured SLF4J logging |
| API Docs | SpringDoc OpenAPI at `/swagger-ui.html` |
| Tests | JUnit 5 unit tests (AuthenticationServiceTest, AccountRequestServiceTest, UserManagementServiceTest), MockMvc controller tests, integration tests, Postman collection |

### 2. Event Service (`backend/services/event-service`)
> **Tech:** Java 21 · Spring Boot 3.2 · Spring Data JPA · MySQL

| Feature | Details |
|---------|---------|
| Event CRUD | Full lifecycle management with rich event model (title, category, status, sessions, agenda, banner image) |
| Event Lifecycle | `DRAFT → PENDING_APPROVAL → PUBLISHED → ACTIVE → ENDED → ARCHIVED` with admin approval gate |
| Enable/Disable | Enable requests submitted by vendors, approved/rejected by admin without changing lifecycle state |
| Sessions & Agenda | Multi-session events with agenda ordering and reorder support |
| Image Uploads | Banner images and speaker photos uploaded to MinIO via `/events/uploads/*` endpoints |
| Categories | Event categorization via `event_categories` with CRUD |
| Internal API | `/internal/events/{id}/booking-owner` used by Venue Service for booking ownership validation |
| Kafka | Publishes `event.published` on status transition |
| Security | JWT filter with Spring Security |
| Observability | Spring Actuator + Micrometer Prometheus |
| API Docs | SpringDoc OpenAPI |

### 3. Venue-Vendor Service (`backend/services/venue-vendor-service`)
> **Tech:** Node.js · Express · JavaScript · Mongoose · MySQL (via `VenueBooking` model)

| Feature | Details |
|---------|---------|
| Venue Management | CRUD for venues; halls sub-resource; capacity, address, price per day |
| Availability | Calendar-aware booking collision detection via `/venues/{id}/availability` |
| Venue Bookings | Full booking lifecycle — create, confirm payment, cancel, delete |
| Vendor Profiles | Service type, rating, active status |
| Vendor Contracts | Vendor-event contract lifecycle (`PENDING → ACTIVE → COMPLETED`) |
| Vendor Reviews | Rating and comment submission per vendor |
| Internal Payment Confirm | `/venues/internal/bookings/{bookingId}/confirm-payment` used by Finance Service |
| Event Client | `eventClient.js` calls Event Service for booking ownership validation |
| Notification Client | `notificationClient.js` dispatches booking confirmation notifications |
| Sample Data | `seedSampleCatalog.js` seeds venues and vendors for development |
| Observability | `metrics.js` + `telemetry.js` with prom-client metrics |
| API Docs | OpenAPI spec via `openapi.js` |
| Tests | Jest unit tests (auth middleware, contract service), integration tests |

### 4. Ticketing Service (`backend/services/ticketing-service`)
> **Tech:** C# · .NET 10 · ASP.NET Core · MongoDB.Driver

| Feature | Details |
|---------|---------|
| Ticket Types | Multi-tier ticket configurations per event (GA, VIP, Standby, etc.) |
| Registrations | Create registration → initiate payment → confirm on payment callback |
| Seat Maps | `SeatMapController` + `SeatHub` (SignalR) for real-time distributed seat reservation locking |
| Seat Reservation | Distributed lock via `seat_reservations` with `reserved_until` expiry |
| QR Ticket Pass | `QrCodeService` generates QR; `TicketDeliveryAssetService` assembles printable ticket pass |
| Ticket Pass Storage | `TicketPassStorageService` — MinIO-backed storage for generated passes |
| Check-In | `CheckInController` — QR scan validation, CHECKIN_LOG, live stats |
| Attendees | `AttendeesController` — bulk CSV import for invite-only events |
| Waitlist | Auto-promotion on cancellation |
| Idempotency | Duplicate-safe registrations via `Idempotency-Key` header |
| Internal Payment Confirm | `/internal/registrations/{id}/confirm-payment` called by Finance Service |
| Kafka | `TicketingContracts.cs` defines published event contracts (`ticketing.confirmed`) |
| Event Catalog Client | `EventCatalogClient` calls Event Service to validate event existence |
| Notification Dispatch | `NotificationDispatchClient` → `INotificationDispatchClient` interface |
| Security | `JwtAuthenticationMiddleware` + `JwtTokenService` |
| Observability | prometheus-net metrics at `/metrics`, OpenTelemetry tracing |
| API Docs | ASP.NET OpenAPI |
| Tests | xUnit tests: `TicketingServiceTests`, `TicketingControllerTests`, `JwtTokenServiceTests`, Postman collection |

### 5. Finance Service (`backend/services/finance-service`)
> **Tech:** Java 21 · Spring Boot 3.2 · Spring Data JPA · MySQL · Razorpay SDK

| Feature | Details |
|---------|---------|
| Budgets | Per-event budget creation with line items; admin approval/lock flow |
| Expenses | Expense logging against budget items with categories |
| Payments | Razorpay integration — order creation, frontend verification, webhook handling |
| Invoice PDF | `InvoiceAssetService` generates invoice PDF; stored to MinIO via `StorageProperties` |
| Financial Reports | `FinancialReportService` — revenue, expenses, P&L per event |
| Cross-Service Calls | `TicketingClient` calls Ticketing to confirm registration; `VenueBookingClient` confirms venue booking payments; `NotificationClient` dispatches payment notifications |
| Security | JWT filter with Spring Security |
| Observability | Micrometer Prometheus at `/actuator/prometheus` |
| API Docs | SpringDoc OpenAPI |
| Tests | JUnit 5 unit tests (BudgetServiceTest, ExpenseServiceTest, PaymentServiceTest), controller tests, integration tests, Postman collection |

### 6. Notification Service (`backend/services/notification-service`)
> **Tech:** Node.js · Express · JavaScript · KafkaJS · Mongoose · MongoDB

| Feature | Details |
|---------|---------|
| Kafka Consumer | `kafkaConsumerService.js` subscribes to all platform Kafka topics |
| Notification CRUD | List, get, mark-read, delete notifications per user |
| Delivery Logs | `deliveryLogService.js` records delivery outcome per notification per channel |
| Templates | Handlebars-based `NotificationTemplate` model; create/update/preview admin API |
| Preferences | Per-user channel opt-in (`NotificationPreference`) |
| Push Tokens | FCM device token registration/deregistration (`PushToken` model) |
| WebSocket | `socketService.js` — real-time in-app notification delivery |
| Webhook Subscriptions | External webhook subscriber management (`WebhookSubscription` model) |
| Queue Service | `queueService.js` — internal notification delivery queue |
| Email Provider | `emailProvider.js` — Nodemailer SMTP delivery |
| Push Provider | `pushProvider.js` — Firebase Admin SDK FCM delivery |
| Newsletter | Newsletter subscriber management + subscription routes |
| Observability | prom-client metrics at `/metrics` |
| API Docs | OpenAPI spec via `openapi.js` |
| Tests | Jest unit tests + integration tests (notification management, preferences, push tokens, templates, webhooks), Postman collection |

---

## 🔌 API Reference

All endpoints require `Authorization: Bearer <token>` unless marked **Public**. The Swagger UI aggregation hub is available at `http://localhost/docs/` when the stack is running.

### Auth Service — Base: `/api/v1` · Port `8081`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | Public | Register a new user account |
| POST | `/auth/login` | Public | Authenticate and receive JWT tokens |
| POST | `/auth/google/login` | Public | OAuth login via Google |
| POST | `/auth/refresh` | Cookie | Refresh access token using refresh cookie |
| POST | `/auth/logout` | JWT | Invalidate session and clear refresh cookie |
| GET | `/auth/me` | JWT | Get current authenticated user profile |
| PATCH | `/auth/me/profile` | JWT | Update display name, phone, avatar |
| POST | `/auth/mfa/setup` | JWT | Begin TOTP MFA enrollment (returns QR seed) |
| POST | `/auth/mfa/verify` | JWT | Verify OTP and activate MFA |
| POST | `/auth/forgot-password` | Public | Send password reset OTP to email |
| POST | `/auth/reset-password` | Public | Confirm OTP and set new password |
| POST | `/auth/email-verification/resend` | JWT | Resend email OTP |
| POST | `/auth/email-verification/confirm` | Public | Confirm email OTP and activate account |
| GET | `/users` | ADMIN | List all platform users |
| PUT | `/users/{id}/roles` | ADMIN | Assign or change a user's role |
| DELETE | `/users/{id}` | ADMIN | Deactivate user account |
| PATCH | `/users/{id}/reactivate` | ADMIN | Reactivate a deactivated account |
| DELETE | `/users/{id}/gdpr/delete` | ADMIN | Permanently delete user data (GDPR) |
| POST | `/account-requests` | JWT | Submit a vendor access or account change request |
| GET | `/account-requests/me` | JWT | View your own account requests |
| POST | `/account-requests/public/reactivation` | Public | Submit a reactivation request (locked-out users) |
| GET | `/account-requests/public/reactivation/status` | Public | Check reactivation request status |
| DELETE | `/account-requests/{id}` | JWT | Cancel a pending request |
| GET | `/account-requests/admin` | ADMIN | List all pending account requests |
| PATCH | `/account-requests/admin/{id}/approve` | ADMIN | Approve an account request |
| PATCH | `/account-requests/admin/{id}/reject` | ADMIN | Reject an account request |

### Event Service — Base: `/api/v1` · Port `8082`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/events` | Public | List and search events with filters |
| POST | `/events` | VENDOR/ADMIN | Create a new event draft |
| GET | `/events/{id}` | Public | Get full event details |
| PUT | `/events/{id}` | VENDOR/ADMIN | Update event fields |
| DELETE | `/events/{id}` | VENDOR/ADMIN | Archive / soft-delete event |
| PATCH | `/events/{id}/status` | VENDOR/ADMIN | Transition event lifecycle status |
| POST | `/events/{id}/request-enable` | VENDOR | Submit event for admin approval to publish |
| POST | `/events/{id}/enable` | ADMIN | Directly enable a published event |
| POST | `/events/{id}/disable` | ADMIN | Disable a live event |
| POST | `/events/{id}/approval/approve` | ADMIN | Approve a pending event |
| POST | `/events/{id}/approval/request-changes` | ADMIN | Request revisions from organizer |
| POST | `/events/{id}/approval/reject` | ADMIN | Reject a pending event |
| POST | `/events/{id}/approval/resubmit` | VENDOR | Resubmit after requested changes |
| GET | `/events/enable-requests` | ADMIN | List all pending enable requests |
| POST | `/events/enable-requests/{requestId}/approve` | ADMIN | Approve an enable request |
| POST | `/events/enable-requests/{requestId}/reject` | ADMIN | Reject an enable request |
| POST | `/events/uploads/banner-image` | VENDOR/ADMIN | Upload event banner image to MinIO |
| POST | `/events/uploads/speaker-photo` | VENDOR/ADMIN | Upload speaker photo to MinIO |
| POST | `/events/{id}/sessions` | VENDOR/ADMIN | Add a session to an event |
| PUT | `/events/{id}/sessions/{sessionId}` | VENDOR/ADMIN | Update session details |
| DELETE | `/events/{id}/sessions/{sessionId}` | VENDOR/ADMIN | Remove a session |
| GET | `/events/{id}/agenda` | Public | Get ordered agenda items |
| PUT | `/events/{id}/agenda/reorder` | VENDOR/ADMIN | Reorder agenda items |
| GET | `/events/search` | Public | Full-text search across events |
| GET | `/categories` | Public | List all event categories |
| GET | `/internal/events/{id}/booking-owner` | Internal | Cross-service booking ownership check |

### Ticketing Service — Base: `/api/v1` · Port `8084`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/ticket-types` | JWT | List ticket types with optional event filter |
| POST | `/events/{eventId}/ticket-types` | VENDOR/ADMIN | Create a new ticket type for an event |
| PUT | `/events/{eventId}/ticket-types/{id}` | VENDOR/ADMIN | Update ticket type details |
| DELETE | `/events/{eventId}/ticket-types/{id}` | VENDOR/ADMIN | Delete a ticket type |
| GET | `/ticket-types/{id}/seat-map` | JWT | Retrieve current seat availability grid |
| POST | `/ticket-types/{id}/seats/reserve` | JWT | Place a distributed lock on selected seats |
| DELETE | `/ticket-types/{id}/seats/reserve/{reservationId}` | JWT | Release a seat reservation lock |
| POST | `/registrations` | JWT | Create registration and initiate payment |
| GET | `/registrations/me` | JWT | List all registrations for current user |
| GET | `/registrations/{id}/ticket-pass` | JWT | Retrieve QR ticket pass |
| GET | `/events/{eventId}/registrations` | VENDOR/ADMIN | List all registrations for an event |
| DELETE | `/registrations/{id}` | JWT | Cancel a registration (triggers waitlist promotion) |
| POST | `/internal/registrations/{id}/confirm-payment` | Internal | Called by Finance Service on payment success |
| POST | `/events/{eventId}/waitlist` | JWT | Join the waitlist for a sold-out event |
| POST | `/checkin/scan` | VENDOR/ADMIN | Validate and process a QR code scan at gate |
| GET | `/events/{eventId}/checkin/stats` | VENDOR/ADMIN | Real-time check-in statistics |
| POST | `/attendees/import` | VENDOR/ADMIN | Bulk import attendees from CSV |
| GET | `/tickets/{ticketId}` | JWT | Get individual ticket details |
| GET | `/tickets/me` | JWT | Get all tickets for the current user |

### Finance Service — Base: `/api/v1` · Port `8085`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/events/{eventId}/budget` | VENDOR/ADMIN | Create a budget for an event |
| GET | `/events/{eventId}/budget` | VENDOR/ADMIN | Get the active budget for an event |
| PUT | `/budgets/{budgetId}/approve` | ADMIN | Approve and lock a budget |
| POST | `/budgets/{budgetId}/items` | VENDOR/ADMIN | Add a line item to a budget |
| POST | `/expenses` | VENDOR/ADMIN | Log an actual expense against an event |
| GET | `/events/{eventId}/reports/financial` | VENDOR/ADMIN | Full financial report (revenue, expenses, P&L) |
| POST | `/payments` | JWT | Create a Razorpay order for a registration |
| GET | `/payments/me` | JWT | List all payments for the current user |
| GET | `/payments/{paymentId}/invoice` | JWT | Download invoice as PDF |
| POST | `/payments/webhook` | Razorpay | Receive and process Razorpay payment webhook |
| POST | `/payments/verify` | JWT | Verify payment from frontend and confirm registration |

### Venue-Vendor Service — Base: `/api/v1` · Port `8083`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/venues` | Public | List all active venues |
| POST | `/venues` | ADMIN | Create a new venue |
| GET | `/venues/{id}` | Public | Get venue details including halls |
| PUT | `/venues/{id}` | ADMIN | Update venue information |
| DELETE | `/venues/{id}` | ADMIN | Deactivate a venue |
| GET | `/venues/bookings` | VENDOR/ADMIN | List all venue bookings |
| GET | `/venues/{id}/availability` | JWT | Check venue availability for a date range |
| POST | `/venues/{id}/book` | VENDOR/ADMIN | Book a venue for an event |
| POST | `/venues/internal/bookings/{id}/confirm-payment` | Internal | Mark booking confirmed after payment |
| POST | `/venues/bookings/{id}/cancel` | VENDOR/ADMIN | Cancel an active booking |
| DELETE | `/venues/bookings/{id}` | ADMIN | Delete a booking record |
| GET | `/vendors` | JWT | List all vendors |
| POST | `/vendors` | ADMIN | Register a new vendor |
| GET | `/vendors/{id}/events` | JWT | Get events a vendor is contracted for |
| POST | `/vendors/{id}/reviews` | JWT | Submit a review for a vendor |
| POST | `/events/{id}/vendors` | VENDOR/ADMIN | Hire a vendor for an event |
| PATCH | `/contracts/{id}/status` | VENDOR/ADMIN | Update contract status |

### Notification Service — Base: `/api/v1` · Port `8086`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/notifications/send` | Internal | Internal trigger to dispatch a notification |
| GET | `/notifications` | JWT | List notifications for current user |
| GET | `/notifications/{id}` | JWT | Get a single notification |
| PATCH | `/notifications/{id}/read` | JWT | Mark a notification as read |
| DELETE | `/notifications/{id}` | JWT | Delete a notification |
| GET | `/notifications/delivery-logs` | ADMIN | View delivery status logs |
| GET | `/notifications/templates` | ADMIN | List all notification templates |
| POST | `/notifications/templates` | ADMIN | Create a new template |
| PUT | `/notifications/templates/{id}` | ADMIN | Update a template |
| POST | `/notifications/templates/{id}/preview` | ADMIN | Preview rendered template output |
| GET | `/notifications/preferences` | JWT | Get user notification channel preferences |
| POST | `/notifications/preferences` | JWT | Update notification opt-in settings |
| GET | `/notifications/push-tokens` | JWT | List registered push tokens |
| POST | `/notifications/push-tokens` | JWT | Register a device push token |
| DELETE | `/notifications/push-tokens` | JWT | Unregister a device push token |
| GET | `/notifications/webhook-subscriptions` | ADMIN | List all external webhook subscriptions |
| POST | `/notifications/webhook-subscriptions` | ADMIN | Create a new webhook subscription |
| DELETE | `/notifications/webhook-subscriptions/{id}` | ADMIN | Remove a webhook subscription |
| POST | `/newsletter/subscribe` | Public | Subscribe an email to the newsletter |

---

## ✨ Features

### 🔐 Authentication & Authorization
- **OTP-Verified Registration** — TOTP via email with expiry & resend
- **JWT Authentication** — Access token + refresh token rotation with HTTP-only cookies
- **Google OAuth** — Sign in with Google; auto-provisions account on first login
- **MFA** — TOTP-based multi-factor authentication enrollment from settings
- **Role-Based Access Control** — Admin, Vendor, Organizer, Customer, Attendee roles with Spring Security guards
- **Account Lifecycle** — Full self-service lifecycle: deactivation, reactivation, GDPR deletion, all with admin approval
- **PII Encryption** — AES encryption for personally identifiable fields

### 🎫 Event & Ticketing
- **Full Event Lifecycle** — Draft → Pending Approval → Published → Active → Ended → Archived with state machine enforcement
- **Multi-Session Events** — Agenda management with session scheduling and reordering
- **Multi-Tier Tickets** — VIP, General, Standby with per-type pricing & capacity
- **Seat Selection** — Real-time distributed seat reservation locking via SignalR hub
- **Digital Ticket Wallet** — QR code tickets with PDF export via jsPDF
- **QR Check-In** — Browser-based QR scanning (jsQR) at event entry with live statistics
- **Waitlist System** — Auto-promotion when capacity frees up on cancellation
- **Bulk Attendee Import** — CSV import for invite-only events

### 💰 Finance & Payments
- **Budget Management** — Per-event budgets with line item tracking and admin approval/lock
- **Expense Tracking** — Categorized expenses logged against budget items
- **Razorpay Integration** — Real payment flow: order creation → browser modal → HMAC signature verification → webhook confirmation
- **Invoice PDF** — Server-generated invoice PDFs stored to MinIO, downloadable by attendees
- **Financial Reports** — Revenue, expenses, P&L per event

### 🏢 Venue & Vendor Management
- **Venue CRUD** — Capacity, location, halls, price per day
- **Availability Check** — Calendar-aware collision detection prevents double-booking
- **Vendor Catalog** — Service type, rating, active status
- **Contract Lifecycle** — Pending → Active → Completed contract management
- **Vendor Reviews** — Rating and comment submission

### 🔔 Real-Time Notifications
- **Multi-Channel Delivery** — In-App (WebSocket), Email (Nodemailer SMTP), Push (Firebase FCM)
- **Kafka-Driven** — All notifications triggered by domain events across services
- **Handlebars Templates** — Admin-managed reusable templates with live preview
- **Delivery Logs** — Per-notification delivery outcome tracking
- **Webhook Subscriptions** — External subscribers can register for notification events
- **User Preferences** — Per-channel opt-in preferences

### 📊 Analytics & Observability
- **Admin Dashboard** — Platform-wide event, user, and financial analytics
- **Vendor Dashboard** — Per-vendor event portfolio, bookings, budget overview
- **Recharts** — Interactive data visualizations
- **Distributed Tracing** — Correlated traces via OpenTelemetry + Tempo, visible in Grafana
- **Log Aggregation** — Loki + Promtail collects all container logs, queryable in Grafana
- **Autoscaler** — EC2 systemd autoscaler monitors service load and issues `docker compose scale` commands

---

## 🗄 Database Schema

EventZen uses a **per-service database isolation** strategy — no cross-database queries exist between services. Internal REST endpoints handle cross-service data needs.

### MySQL Databases (Relational Data)

```
┌─────────────────────────────────────────┐
│  Auth DB (MySQL)                        │
│  ├── users                              │
│  │   (id, email, password_hash,         │
│  │    is_active, mfa_enabled,           │
│  │    mfa_secret, created_at)           │
│  ├── roles                              │
│  ├── permissions                        │
│  ├── user_roles                         │
│  ├── role_permissions                   │
│  ├── refresh_tokens                     │
│  ├── account_requests                   │
│  │   (type: VENDOR_ACCESS / DEACTIVATE  │
│  │    / REACTIVATE / GDPR_DELETE)       │
│  └── audit_logs                         │
├─────────────────────────────────────────┤
│  Event DB (MySQL)                       │
│  ├── events                             │
│  │   (id, title, organizer_id,          │
│  │    category_id, status,              │
│  │    start_time, end_time,             │
│  │    banner_image_url)                 │
│  ├── event_sessions                     │
│  │   (speaker_name, start/end_time)     │
│  ├── event_agenda                       │
│  │   (title, order_index)              │
│  ├── event_categories                   │
│  └── event_enable_requests              │
├─────────────────────────────────────────┤
│  Finance DB (MySQL)                     │
│  ├── budgets                            │
│  │   (event_id, estimated_total,        │
│  │    approved_total, status)           │
│  ├── budget_items                       │
│  │   (category, estimated_amount,       │
│  │    actual_amount)                    │
│  ├── expenses                           │
│  │   (event_id, amount, category,       │
│  │    receipt_url)                      │
│  └── payments                           │
│      (registration_id, amount,          │
│       razorpay_order_id,                │
│       razorpay_payment_id, status)      │
├─────────────────────────────────────────┤
│  Venue & Vendor DB (MySQL)              │
│  ├── venues                             │
│  │   (name, address, city, capacity,    │
│  │    price_per_day, is_active)         │
│  ├── venue_halls                        │
│  │   (venue_id, name, capacity)        │
│  ├── vendors                            │
│  │   (name, service_type, rating)      │
│  ├── event_venue_bookings               │
│  │   (event_id, venue_id, hall_id,      │
│  │    start_date, end_date, status)     │
│  ├── event_vendor_contracts             │
│  │   (event_id, vendor_id,              │
│  │    agreed_price, status)             │
│  └── vendor_reviews                     │
├─────────────────────────────────────────┤
│  Ticketing DB (MySQL)                   │
│  ├── ticket_types                       │
│  │   (event_id, name, price,            │
│  │    total_quantity,                   │
│  │    remaining_quantity)               │
│  ├── attendees                          │
│  │   (first_name, last_name, email,     │
│  │    phone)                            │
│  ├── event_registrations                │
│  │   (event_id, attendee_id,            │
│  │    ticket_type_id, status,           │
│  │    qr_payload, idempotency_key)      │
│  ├── tickets                            │
│  │   (registration_id, issued_at,       │
│  │    seat_info)                        │
│  ├── seat_reservations                  │
│  │   (ticket_type_id, seat_label,       │
│  │    reserved_until) ← distributed lock│
│  ├── waitlists                          │
│  │   (event_id, attendee_id, position) │
│  └── checkin_logs                       │
│      (registration_id, checkin_time,    │
│       gate, status)                     │
└─────────────────────────────────────────┘
```

### MongoDB Databases (Document Data)

```
┌─────────────────────────────────────────┐
│  eventzen_notifications (MongoDB)       │
│  ├── notifications                      │
│  │   (user_id, title, message,          │
│  │    type, is_read, channel,           │
│  │    created_at)                       │
│  ├── notification_templates             │
│  │   (name, subject,                   │
│  │    body_handlebars, variables)       │
│  ├── notification_preferences           │
│  │   (user_id, channel, is_enabled)    │
│  ├── push_tokens                        │
│  │   (user_id, token, platform)        │
│  ├── delivery_logs                      │
│  │   (notification_id, channel,         │
│  │    status, error, timestamp)         │
│  ├── newsletter_subscribers             │
│  └── webhook_subscriptions             │
│      (url, events, secret)             │
└─────────────────────────────────────────┘
```

---

## 🔐 Security Implementation

### Defense in Depth

```
┌─────────────────────────────────────────────────────────────┐
│                      Nginx Gateway                           │
│  Reverse Proxy │ CORS Whitelist │ Request Size Limits        │
│  Rate Limiting │ TLS Termination (Production)                │
├─────────────────────────────────────────────────────────────┤
│                   Service-Level Security                     │
│  Spring Security (Java) │ JWT Middleware (.NET / Node)       │
│  Zod Input Validation (Node) │ Bean Validation (Java)        │
│  FluentValidation (.NET) │ @ControllerAdvice error handling  │
├─────────────────────────────────────────────────────────────┤
│             Authentication & Authorization                   │
│  JWT Access + Refresh Tokens │ bcrypt Password Hashing       │
│  TOTP OTP Verification │ TOTP MFA Enrollment                 │
│  Role-Based Guards │ PII AES Encryption                      │
│  HMAC-SHA256 Seat Reservation Security                       │
├─────────────────────────────────────────────────────────────┤
│                   Secrets Management                         │
│  HashiCorp Vault KV v2 │ AppRole Authentication             │
│  Vault Agent Sidecar → tmpfs-mounted env files              │
│  Zero .env files at rest │ Windows DPAPI bootstrap seeding  │
│  No secrets in source control or filesystem                  │
└─────────────────────────────────────────────────────────────┘
```

### Security Features by Layer

| Layer | Implementation |
|-------|---------------|
| **Transport** | Nginx CORS whitelist, request size limits, TLS termination in production |
| **Authentication** | JWT access + refresh tokens with rotation, HTTP-only cookie storage |
| **Password** | bcrypt hashing, TOTP OTP for email verification and MFA |
| **Input Validation** | Zod (Node.js), Bean Validation (Java), FluentValidation (.NET) |
| **Rate Limiting** | Nginx global rate limiting |
| **Secrets** | HashiCorp Vault KV v2 with Vault Agent sidecar; zero credentials at rest |
| **PII Protection** | AES encryption via `FieldEncryptionService` for personal data fields |
| **Payment Security** | Razorpay HMAC-SHA256 signature verification for webhook and frontend verify flows |
| **Idempotency** | `Idempotency-Key` header on ticketing registrations prevents duplicate bookings |

### HashiCorp Vault Integration Detail

1. **Secret Seeding** — A PowerShell bootstrap script encrypts all platform secrets using Windows DPAPI and stores them in `.secrets/local-vault-secrets.dpapi`. On startup these are decrypted in memory and written to Vault's KV store.
2. **Vault Agent Sidecar** — A Vault Agent container authenticates to Vault using AppRole and renders secret templates from `vault/agent/eventzen.env.ctmpl` into `tmpfs` (in-memory) volumes mounted by each service container.
3. **No `.env` Files At Rest** — Service containers read all credentials from the tmpfs-mounted rendered files. No credentials ever touch the filesystem or source control.
4. **Vault UI** — Accessible at `http://localhost:8200/ui` during local development.

---

## 📨 Event-Driven Architecture (Kafka)

### Kafka Topics

| Topic | Producer | Consumer | Purpose |
|-------|----------|----------|---------|
| `event.published` | Event Service | Notification Service | Notify subscribers when an event goes live |
| `ticketing.confirmed` | Ticketing Service | Notification Service | Send QR ticket confirmation email after registration |
| `payment.verified` | Finance Service | Ticketing Service | Trigger registration confirmation on payment success |
| `system.health` | All Services | Monitoring | Internal health check heartbeats |

### Producer → Consumer Flow

```
Auth Service ─────→ user.registered ────→ Notification Service
                    user.password.reset     │
                                            │  Creates notification
Event Service ────→ event.published ───→    │  records in MongoDB
                                            │
                                            │  Routes to channels:
Finance Service ──→ payment.verified ──→    │  • IN_APP (WebSocket)
                                            │  • EMAIL (Nodemailer)
                                            │  • PUSH (Firebase FCM)
                    payment.verified ──→ Ticketing Service
                                       (confirm-payment internal call)
                                       → QR ticket generated
                                       → ticketing.confirmed published
                                            │
Ticketing Service → ticketing.confirmed ──→ Notification Service
                                            (ticket confirmation email)
```

Kafka and Zookeeper run as Docker containers within the Compose stack. **Kafka UI** is exposed at `http://localhost:8091/` for topic and consumer group inspection.

---

## 📊 Monitoring & Observability

### Full Observability Stack

| Tool | URL | Purpose |
|------|-----|---------|
| **Prometheus** | `http://localhost:9090/` | Metrics scraping from all services (JVM, Node.js, .NET, custom business metrics), 15s scrape interval |
| **Grafana** | `http://localhost:3308/` | Pre-built dashboards for service health, request rates, error rates, JVM heap |
| **Loki + Promtail** | Internal | Log aggregation — structured logs from all containers collected and queryable in Grafana |
| **Tempo** | Internal | Distributed tracing storage backend |
| **OpenTelemetry Collector** | Internal | OTLP trace and metric collection from all services, forwarded to Tempo and Prometheus |

### Metrics Collection per Service

| Service | Metrics Path | Library |
|---------|-------------|---------|
| Auth Service | `/actuator/prometheus` | Micrometer |
| Event Service | `/actuator/prometheus` | Micrometer |
| Finance Service | `/actuator/prometheus` | Micrometer |
| Venue-Vendor Service | `/metrics` | prom-client |
| Notification Service | `/metrics` | prom-client |
| Ticketing Service | `/metrics` | prometheus-net |

### Distributed Tracing

A single request crossing multiple services (e.g., checkout → payment → ticketing confirm → notification) produces a correlated trace visible in Grafana's Explore panel using Tempo as the backend.

---

## 🗺 Diagrams & Design Documentation

All diagram files are located in the `docs/` directory:

| File | Type | Description |
|------|------|-------------|
| `docs/mermaid-uml-class-diagram.md` | Class Diagram | Core entity model with relationships across all six domains |
| `docs/mermaid-userflow-admin.md` | Flowchart | Admin portal journey from login to governance and approvals |
| `docs/mermaid-userflow-vendor.md` | Flowchart | Vendor/organizer journey from event creation to check-in and reporting |
| `docs/mermaid-userflow-customer.md` | Flowchart | Customer journey from event discovery to ticket wallet |
| `docs/uml-class-diagram.drawio` | Class Diagram | draw.io format full class diagram |
| `docs/userflow-admin.drawio` | User Flow | Admin portal user flow |
| `docs/userflow-vendor.drawio` | User Flow | Vendor portal user flow |
| `docs/userflow-customer.drawio` | User Flow | Customer portal user flow |
| `docs/images/AdminUserFlow.drawio.png` | Image | Admin user flow diagram (PNG) |
| `docs/images/VendorUserFlow.drawio.png` | Image | Vendor user flow diagram (PNG) |
| `docs/images/CustomerUserFlow.drawio.png` | Image | Customer user flow diagram (PNG) |
| `docs/images/LandingPage.png` | Screenshot | Landing page |
| `docs/EventZen_System_Design.md` | Architecture | Detailed system design, service contracts, and infrastructure decisions |
| `docs/EventZen_PRD_v4.md` | Requirements | Full product requirements document with acceptance criteria |
| `docs/Notifications_ERD.md` | ERD | Notification domain entity-relationship diagram |
| `docs/pdf/EventZen_PRD_v3.pdf` | PRD | Product requirements v3 (PDF) |
| `docs/pdf/EventZen_PRD_v5.pdf` | PRD | Product requirements v5 (PDF) |

### EventZen UI Previews

Below is a glimpse of the actual EventZen platform UI. To view the complete collection of all 50+ UI screenshots, please browse the [docs/eventzenUI](./docs/eventzenUI/) folder.

**UI Preview 1**
![UI Preview 1](docs/eventzenUI/EventZenUI%20(1).png)

**UI Preview 2**
![UI Preview 2](docs/eventzenUI/EventZenUI%20(2).png)

**UI Preview 3**
![UI Preview 3](docs/eventzenUI/EventZenUI%20(3).png)

**UI Preview 4**
![UI Preview 4](docs/eventzenUI/EventZenUI%20(4).png)

**UI Preview 5**
![UI Preview 5](docs/eventzenUI/EventZenUI%20(5).png)

**UI Preview 6**
![UI Preview 6](docs/eventzenUI/EventZenUI%20(6).png)

**UI Preview 7**
![UI Preview 7](docs/eventzenUI/EventZenUI%20(7).png)

**UI Preview 8**
![UI Preview 8](docs/eventzenUI/EventZenUI%20(8).png)

**UI Preview 9**
![UI Preview 9](docs/eventzenUI/EventZenUI%20(9).png)

**UI Preview 10**
![UI Preview 10](docs/eventzenUI/EventZenUI%20(10).png)

**UI Preview 11**
![UI Preview 11](docs/eventzenUI/EventZenUI%20(11).png)

**UI Preview 12**
![UI Preview 12](docs/eventzenUI/EventZenUI%20(12).png)

**UI Preview 13**
![UI Preview 13](docs/eventzenUI/EventZenUI%20(13).png)

**UI Preview 14**
![UI Preview 14](docs/eventzenUI/EventZenUI%20(14).png)

**UI Preview 15**
![UI Preview 15](docs/eventzenUI/EventZenUI%20(15).png)

---

## 📂 Project Structure

```text
Deloitte_CloudThat_Capstone_Project/
├── docker-compose.yml                   # Core application stack (all services + infra)
├── docker-compose.vault.yml             # HashiCorp Vault + Vault Agent sidecar config
├── README.md
├── autoscaler-state/                    # Per-service last-scaled state files for EC2 autoscaler
│   ├── auth-service.last_scaled
│   ├── event-service.last_scaled
│   ├── ticketing-service.last_scaled
│   └── venue-vendor-service.last_scaled
│
├── docs/                                # Architecture, UML, ERDs, PRDs, user flow diagrams
│
├── examples/                            # Sample event and venue JSON payloads
│   ├── events/
│   └── venues/
│
├── monitoring/                          # Full observability stack configs
│   ├── prometheus/                      # Scrape configs
│   ├── grafana/provisioning/            # Pre-built dashboards
│   ├── loki/                            # Log aggregation
│   ├── promtail/                        # Log collection
│   ├── tempo/                           # Distributed tracing
│   └── otel-collector/                  # OpenTelemetry Collector
│
├── vault/                               # HashiCorp Vault config
│   ├── agent/                           # Vault Agent HCL + eventzen.env.ctmpl template
│   └── scripts/                         # Vault policy + KV mount scripts
│
├── scripts/                             # PowerShell lifecycle scripts
│   ├── bootstrap-local-vault-machine.ps1
│   ├── start-local-vault.ps1
│   ├── stop-local-vault.ps1
│   ├── set-local-vault-secrets.ps1
│   └── refresh-swagger-specs.ps1
│
├── frontend/                            # React 18 SPA (Vite 6, Tailwind CSS 4)
│   ├── Dockerfile                       # Nginx-based production container
│   ├── nginx.conf                       # SPA routing + caching headers
│   ├── vite.config.js                   # Vite + proxy config
│   ├── package.json
│   ├── index.html
│   └── src/
│       ├── main.jsx                     # Application entry point
│       └── app/
│           ├── App.jsx                  # Root app + provider setup
│           ├── routes.jsx               # 28+ route definitions with lazy loading
│           ├── components/              # Shared UI and layout components
│           │   ├── AdminLayout.jsx
│           │   ├── PortalLayout.jsx
│           │   ├── Navigation.jsx
│           │   ├── Footer.jsx
│           │   ├── RequireAuth.jsx
│           │   ├── RequireAdmin.jsx
│           │   ├── RequireVendorAccess.jsx
│           │   ├── RequireCustomerPortal.jsx
│           │   ├── AuthSessionMonitor.jsx
│           │   ├── LoadingScreen.jsx
│           │   ├── PushNotificationBootstrap.jsx
│           │   ├── InfiniteGridBackground.jsx
│           │   └── ui/                  # Radix-based design system primitives
│           └── pages/                   # Route-level page components
│               ├── (auth, events, tickets, checkout)
│               ├── customer/
│               ├── vendor/
│               └── admin/
│
└── backend/
    ├── docker/                          # Shared Docker configs
    │   ├── nginx/                       # Nginx config, Swagger UI, OpenAPI specs
    │   │   ├── nginx.conf
    │   │   ├── nginx.prod.template.conf
    │   │   └── static/docs/
    │   │       ├── index.html           # Swagger hub landing
    │   │       ├── specs/               # Auto-generated OpenAPI JSONs per service
    │   │       └── swagger.js
    │   └── mysql/init/
    │       └── 01-create-databases.sql
    │
    ├── infrastructure/                  # Cloud deployment scripts
    │   ├── deploy-ec2.sh                # Transfer Compose stack to EC2
    │   ├── ec2-bootstrap.sh             # Install Docker on fresh Amazon Linux
    │   ├── eventzen-autoscaler.sh       # Systemd-managed autoscaler
    │   ├── eventzen-autoscaler.service  # Systemd unit file
    │   ├── render-nginx-prod.sh         # Generate Nginx prod config for domain + TLS
    │   ├── test-rate-limit.sh           # Validate Nginx rate limiting post-deploy
    │   ├── upload-deploy-files.sh       # SCP upload helper
    │   └── ecs/                         # ECS migration reference docs
    │       ├── README.md
    │       ├── compose-to-ecs-mapping-guide.md
    │       ├── ecs-structure-migration-guide.md
    │       ├── secrets-manager-mapping.md
    │       ├── service-creation-mapping.md
    │       ├── target-group-mapping.md
    │       └── task-definitions/        # ECS task definition JSONs per service
    │
    └── services/
        ├── auth-service/                # Java 21 / Spring Boot 3.2
        │   ├── Dockerfile
        │   ├── pom.xml
        │   ├── README.md
        │   ├── TEST_CASES.md
        │   └── src/main/java/com/eventzen/auth/
        │       ├── config/              # Security, JWT, OpenAPI, DataSeeder
        │       ├── controller/          # Auth, User, AccountRequest, Home
        │       ├── dto/                 # Request/Response DTOs
        │       ├── entity/              # User, Role, AccountRequest, AuditLog
        │       ├── exception/           # GlobalExceptionHandler
        │       ├── repository/          # JPA repositories
        │       ├── security/            # JwtService, TotpService, FieldEncryptionService
        │       └── service/             # AuthenticationService, AccountRequestService, etc.
        │
        ├── event-service/               # Java 21 / Spring Boot 3.2
        │   ├── Dockerfile
        │   ├── pom.xml
        │   ├── README.md
        │   └── src/main/java/com/eventzen/event/
        │       ├── config/
        │       ├── controller/
        │       ├── dto/
        │       ├── entity/
        │       ├── exception/
        │       ├── repository/
        │       └── service/
        │
        ├── venue-vendor-service/        # Node.js / Express (JavaScript)
        │   ├── Dockerfile
        │   ├── package.json
        │   ├── README.md
        │   ├── TEST_CASES.md
        │   └── src/
        │       ├── app.js
        │       ├── server.js
        │       ├── openapi.js
        │       ├── config/              # database.js, env.js
        │       ├── constants/           # domain.js, errorCodes.js, roles.js
        │       ├── middleware/          # auth, errorHandler, validate
        │       ├── models/              # Venue, Vendor, VenueBooking, VendorContract
        │       ├── observability/       # metrics.js, telemetry.js
        │       ├── routes/              # venues, vendors, contracts, events, health
        │       ├── seeds/               # sampleCatalog.js, seedSampleCatalog.js
        │       ├── services/            # venueService, vendorService, contractService
        │       │                          eventClient, notificationClient
        │       ├── utils/               # apiError, asyncHandler, pagination
        │       └── validators/          # venueValidators, vendorValidators, etc.
        │
        ├── ticketing-service/           # C# / .NET 10 / ASP.NET Core
        │   ├── Dockerfile
        │   ├── ticketing-service.sln
        │   ├── README.md
        │   ├── TEST_CASES.md
        │   └── src/EventZen.Ticketing.Api/
        │       ├── Program.cs
        │       ├── Controllers/         # TicketTypes, Registrations, Tickets,
        │       │                          CheckIn, Attendees, SeatMap
        │       ├── Domain/Entities.cs   # All domain entities
        │       ├── Infrastructure/      # MongoTicketingRepository, ITicketingRepository
        │       ├── Services/            # TicketingService, QrCodeService,
        │       │                          TicketDeliveryAssetService,
        │       │                          EventCatalogClient, NotificationDispatchClient
        │       ├── Security/            # JwtAuthenticationMiddleware, JwtTokenService
        │       ├── Middleware/          # ExceptionHandlingMiddleware
        │       ├── Hubs/SeatHub.cs      # SignalR real-time seat map
        │       ├── Contracts/           # TicketingContracts.cs (Kafka event shapes)
        │       └── Options/             # JwtOptions, MongoOptions, etc.
        │
        ├── finance-service/             # Java 21 / Spring Boot 3.2
        │   ├── Dockerfile
        │   ├── pom.xml
        │   ├── TEST_CASES.md
        │   └── src/main/java/com/eventzen/finance/
        │       ├── config/              # Security, Razorpay, OpenAPI, JWT
        │       ├── controller/          # Budget, Expense, Payment, Report, Home
        │       ├── dto/
        │       ├── exception/
        │       ├── model/               # Budget, BudgetItem, Expense, Payment
        │       ├── repository/
        │       ├── security/            # JwtAuthenticationFilter, JwtService
        │       └── service/             # BudgetService, PaymentService, ExpenseService,
        │                                  FinancialReportService, InvoiceAssetService,
        │                                  RazorpayClient, TicketingClient,
        │                                  VenueBookingClient, NotificationClient
        │
        └── notification-service/        # Node.js / Express (JavaScript)
            ├── Dockerfile
            ├── package.json
            ├── README.md
            ├── TEST_CASES.md
            └── src/
                ├── app.js
                ├── server.js
                ├── openapi.js
                ├── config/              # database.js, env.js
                ├── constants/           # channels.js, eventTopics.js, roles.js
                ├── middleware/          # auth, errorHandler, requestContext, validate
                ├── models/              # Notification, NotificationTemplate,
                │                          NotificationPreference, PushToken,
                │                          DeliveryLog, WebhookSubscription,
                │                          NewsletterSubscriber
                ├── observability/       # metrics.js, telemetry.js
                ├── providers/           # channelProviders, emailProvider, pushProvider
                ├── routes/              # notifications, templates, preferences,
                │                          pushTokens, webhooks, newsletter, health
                ├── seeds/               # defaultTemplates, seedDefaultTemplates
                ├── services/            # notificationService, kafkaConsumerService,
                │                          deliveryLogService, templateService,
                │                          preferenceService, queueService, socketService,
                │                          pushTokenService
                ├── utils/               # apiError, asyncHandler, pagination,
                │                          signature, templateRenderer
                └── validators/          # notificationValidators, preferenceValidators, etc.
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Required For |
|------|---------|-------------|
| **Docker Desktop** | Latest (Linux containers) | All infrastructure containers |
| **PowerShell** | 5.1+ | Bootstrap and lifecycle scripts (Windows) |
| **RAM** | 8 GB minimum | Full stack (20+ containers) |

> All runtime dependencies (Java, .NET, Node.js, MySQL, MongoDB, Kafka, Vault, etc.) run inside Docker containers — no local language runtimes required.

## 🔐 HashiCorp Vault Setup

This repository includes a Docker-based local Vault setup for backend runtime secrets. You do not need to install Vault manually on Windows. Sensitive values are stored in an encrypted local Windows secret store using DPAPI, keeping your configuration out of the repository, and are loaded into memory only when the Vault startup script runs.

### Step-by-Step Setup

**1. Copy Environment Configuration**
```powershell
Copy-Item .env.example .env
```

**2. Configure Secrets**
Replace all the placeholder secrets in `.env` with real values.

**3. Import Secrets into Vault DPAPI**
Import the managed secret keys from your `.env` file into the encrypted store:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\set-local-vault-secrets.ps1 -ImportFromEnvFile .\.env
```
*(Only the managed secret keys are imported. Non-secret config values are ignored.)*

**4. Bootstrap Vault Environment (First Run Only)**
This one-command bootstrap verifies Docker, creates the local secret store under `.secrets/local-vault-secrets.dpapi`, builds the Docker images, and sets up your Vault instance.
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-local-vault-machine.ps1
```

**5. Start the Local Vault Stack**
Start the entire service stack, infrastructure, and Vault sidecar (wait ~60 seconds for health checks to pass):
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local-vault.ps1
```
> **Notes:** 
> - Rerunning this script while the stack is already running will cause it to query available ports and potentially alter host port mappings.
> - The Vault UI will be available at `http://localhost:8200/ui`

### Platform Rebuilds

To rebuild the Vault-backed stack in place without reassigning host ports:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\rebuild-local-vault.ps1
```

Rebuild only specific services while preserving current port mappings:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\rebuild-local-vault.ps1 -Services auth-service
```

### Stopping the Platform

Stop the local Vault stack with:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-local-vault.ps1
```

For a clean reset that also removes volumes:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-local-vault.ps1 -RemoveVolumes
```

---

## 🛠 Useful Commands & Administration

### Refreshing Swagger Specs
If you change backend API endpoints, controllers, or models, the published Swagger specs need to be regenerated:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\refresh-swagger-specs.ps1
```

### Accessing the Vault Root Token
The local Vault root token is stored in the encrypted DPAPI secret store. To print it from PowerShell:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; . .\scripts\vault\local-secret-store.ps1; $secrets = Read-EventZenLocalSecretStore; $secrets["VAULT_DEV_ROOT_TOKEN_ID"]
```

### Raw Docker Compose Commands (Vault Stack)
```bash
# View all container states
docker compose -f docker-compose.yml -f docker-compose.vault.yml ps

# View aggregate logs
docker compose -f docker-compose.yml -f docker-compose.vault.yml logs -f

# View single service logs
docker compose -f docker-compose.yml -f docker-compose.vault.yml logs -f auth-service

# Stop and remove orphans
docker compose -f docker-compose.yml -f docker-compose.vault.yml down --remove-orphans

# Stop and remove volumes
docker compose -f docker-compose.yml -f docker-compose.vault.yml down -v
```

---

## 🧪 Testing

> **Important:** For automated testing, you will need to provide an individual `.env` file within each specific service directory. Automated tests run independently of the global Docker and HashiCorp Vault setup.

### Unit Tests

Each service has a complete unit test suite. Run them individually:

```bash
# Auth Service (JUnit 5 + Spring Boot Test)
cd backend/services/auth-service
./mvnw clean test

# Event Service (JUnit 5)
cd backend/services/event-service
./mvnw clean test

# Finance Service (JUnit 5)
cd backend/services/finance-service
./mvnw clean test

# Ticketing Service (xUnit .NET)
cd backend/services/ticketing-service
dotnet test .\tests\EventZen.Ticketing.Tests\EventZen.Ticketing.Tests.csproj

# Venue-Vendor Service (Jest)
cd backend/services/venue-vendor-service
npm test

# Notification Service (Jest)
cd backend/services/notification-service
npm test
```

### Test Coverage by Service

| Service | Test Types | Notable Tests |
|---------|-----------|---------------|
| **Auth Service** | Unit, Controller (MockMvc), Integration | AuthenticationServiceTest, AccountRequestServiceTest, AuthControllerTest, UserControllerTest, JwtServiceTest, TotpServiceTest, FieldEncryptionServiceTest |
| **Finance Service** | Unit, Controller, Integration | BudgetServiceTest, ExpenseServiceTest, PaymentServiceTest, FinanceControllerTest |
| **Ticketing Service** | Unit, Controller | TicketingServiceTests, TicketingControllerTests, JwtTokenServiceTests |
| **Venue-Vendor Service** | Unit, Integration | auth middleware, contract service, venue-vendor integration tests |
| **Notification Service** | Unit, Integration | notification management, preferences, pushToken, template, webhook, signature, templateRenderer |

### API Testing (Postman)

Postman collections and environments are included per service:

| Service | Collection |
|---------|-----------|
| Auth Service | `backend/services/auth-service/src/test/postman/` |
| Finance Service | `backend/services/finance-service/tests/postman/` |
| Ticketing Service | `backend/services/ticketing-service/tests/postman/` |
| Notification Service | `backend/services/notification-service/postman/` |

### OpenAPI Specs

All service OpenAPI specs are aggregated under the Nginx static docs server at `http://localhost/docs/`:

| Service | Spec Path |
|---------|-----------|
| Auth | `/docs/openapi-specs/auth-service.json` |
| Event | `/docs/openapi-specs/event-service.json` |
| Finance | `/docs/openapi-specs/finance-service.json` |
| Ticketing | `/docs/openapi-specs/ticketing-service.json` |
| Venue & Vendor | `/docs/openapi-specs/venue-vendor-service.json` |
| Notification | `/docs/openapi-specs/notification-service.json` |

---

## 🌐 Access Points

| Service | URL |
|---------|-----|
| **Web Application** | `http://localhost/` |
| **Swagger Documentation Hub** | `http://localhost/docs/` |
| **HashiCorp Vault UI** | `http://localhost:8200/ui` |
| **Grafana Dashboards** | `http://localhost:3308/` |
| **Prometheus** | `http://localhost:9090/` |
| **MinIO Storage Console** | `http://localhost:9001/` |
| **Kafka UI** | `http://localhost:8091/` |
| Auth Service (direct) | `http://localhost:8081/` |
| Event Service (direct) | `http://localhost:8082/` |
| Venue-Vendor Service (direct) | `http://localhost:8083/` |
| Ticketing Service (direct) | `http://localhost:8084/` |
| Finance Service (direct) | `http://localhost:8085/` |
| Notification Service (direct) | `http://localhost:8086/` |

### Frontend Routes Reference

| URL | Page | Access |
|-----|------|--------|
| `/` | Landing Page | Public |
| `/auth` | Login / Register / MFA / OTP | Public |
| `/events` | Browse All Events | Public |
| `/events/:id` | Event Detail Page | Public |
| `/events/:id/seats/:ticketTypeId` | Interactive Seat Selection | Auth |
| `/events/:id/checkout/:ticketTypeId` | Checkout + Razorpay | Auth |
| `/my/tickets` | Ticket Wallet | Auth |
| `/my/tickets/:registrationId/pass` | QR Ticket Pass | Auth |
| `/my/registrations` | My Registrations | Auth |
| `/account/settings` | Account Settings (MFA, GDPR) | Auth |
| `/account/notifications` | Notification Preferences | Auth |
| `/customer/dashboard` | Customer Dashboard | CUSTOMER |
| `/vendor/dashboard` | Vendor Dashboard | VENDOR |
| `/vendor/events` | Event Management | VENDOR |
| `/vendor/venues` | Venue Booking | VENDOR |
| `/vendor/check-in` | QR Check-In Portal | VENDOR |
| `/vendor/finance` | Budget & Expense Management | VENDOR |
| `/vendor/reports` | Financial Reports | VENDOR |
| `/admin/dashboard` | Admin Dashboard | ADMIN |
| `/admin/events` | Manage & Approve Events | ADMIN |
| `/admin/venues` | Manage Venues & Bookings | ADMIN |
| `/admin/vendors` | Manage Vendors | ADMIN |
| `/admin/finance` | Approve Budgets & Payments | ADMIN |
| `/admin/reports` | Cross-Event Analytics | ADMIN |

---

## 📄 License

This project was built as a **Deloitte CloudThat Capstone Project**. Please refer to the organization's licensing terms for usage guidelines.

---

<p align="center">
  <b>Built by Mayukh Haldar</b>
  <br/>
  <sub>React · Spring Boot · .NET · Node.js · Kafka · HashiCorp Vault · Razorpay · Firebase · Docker · Prometheus · Grafana</sub>
</p>