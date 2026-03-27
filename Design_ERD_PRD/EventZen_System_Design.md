# EventZen Event Management System

## System Architecture and ERD Documentation

This document presents the **system architecture and database design** for the **EventZen Event Management System**. The architecture is designed to support scalable event planning operations including event scheduling, vendor coordination, attendee registration, and financial management.

The system is organized into modular components to improve maintainability, scalability, and clarity of the system design.

The architecture includes:

- Top-level system architecture
- Five functional modules
- Clearly defined service boundaries
- Logical grouping of database entities

---

# System Architecture

```mermaid
flowchart TB

    subgraph CLIENT
        A[Customer Portal]
        B[Admin Portal]
    end

    subgraph BACKEND_SERVICES
        C[Authentication Service]
        D[Event Management Service]
        E[Venue & Vendor Service]
        F[Attendee & Ticketing Service]
        G[Finance & Budget Service]
    end

    subgraph DATABASE
        H[(User DB)]
        I[(Event DB)]
        J[(Vendor DB)]
        K[(Ticketing DB)]
        L[(Finance DB)]
    end

    A --> C
    A --> D
    A --> F

    B --> C
    B --> D
    B --> E
    B --> G

    C --> H
    D --> I
    E --> J
    F --> K
    G --> L
```

This architecture separates the application into **frontend portals, backend services, and service-specific databases**, enabling independent scaling and modular development.

---

# Modules

The system is divided into five primary modules:

1. Authentication & User Management
2. Event Management
3. Venue & Vendor Management
4. Attendee & Ticketing
5. Finance & Budget Management

Each module is expandable below to view its detailed **ER diagram**.

---

<details>
<summary><strong>Authentication & User Management Module</strong></summary>

This module manages **users, authentication, and role-based authorization**.

```mermaid
erDiagram

    USER {
        UUID user_id PK
        string first_name
        string last_name
        string email
        string password_hash
        string phone
        boolean is_active
        datetime created_at
    }

    ROLE {
        UUID role_id PK
        string role_name
        string description
    }

    PERMISSION {
        UUID permission_id PK
        string permission_name
        string module
        string action
    }

    USER_ROLE {
        UUID id PK
        UUID user_id FK
        UUID role_id FK
    }

    ROLE_PERMISSION {
        UUID id PK
        UUID role_id FK
        UUID permission_id FK
    }

    USER ||--o{ USER_ROLE : assigned
    ROLE ||--o{ USER_ROLE : contains
    ROLE ||--o{ ROLE_PERMISSION : grants
    PERMISSION ||--o{ ROLE_PERMISSION : defines
```

</details>

---

<details>
<summary><strong>Event Management Module</strong></summary>

This module manages **event creation, scheduling, and agenda management**.

```mermaid
erDiagram

    EVENT {
        UUID event_id PK
        UUID organizer_id FK
        UUID category_id FK
        string event_title
        string event_type
        string description
        datetime start_time
        datetime end_time
        integer expected_attendees
        decimal estimated_budget
        string status
    }

    EVENT_CATEGORY {
        UUID category_id PK
        string category_name
    }

    EVENT_SESSION {
        UUID session_id PK
        UUID event_id FK
        string session_title
        string speaker_name
        datetime start_time
        datetime end_time
    }

    EVENT_AGENDA {
        UUID agenda_id PK
        UUID event_id FK
        string agenda_title
        datetime start_time
        datetime end_time
    }

    EVENT_CATEGORY ||--o{ EVENT : categorizes
    EVENT ||--o{ EVENT_SESSION : contains
    EVENT ||--o{ EVENT_AGENDA : includes
```

</details>

---

<details>
<summary><strong>Venue & Vendor Management Module</strong></summary>

This module handles **venue reservations and vendor service management**.

```mermaid
erDiagram

    VENUE {
        UUID venue_id PK
        string venue_name
        string address
        string city
        integer capacity
        decimal price_per_day
    }

    VENUE_HALL {
        UUID hall_id PK
        UUID venue_id FK
        string hall_name
        integer capacity
    }

    VENDOR {
        UUID vendor_id PK
        string vendor_name
        string service_type
        string email
        string phone
        decimal rating
    }

    EVENT_VENDOR {
        UUID contract_id PK
        UUID event_id FK
        UUID vendor_id FK
        decimal agreed_price
        string contract_status
    }

    EVENT_VENUE_BOOKING {
        UUID booking_id PK
        UUID event_id FK
        UUID venue_id FK
        datetime booking_start
        datetime booking_end
    }

    VENUE ||--o{ VENUE_HALL : contains
    VENUE ||--o{ EVENT_VENUE_BOOKING : reserved
    VENDOR ||--o{ EVENT_VENDOR : hired_for
```

</details>

---

<details>
<summary><strong>Attendee & Ticketing Module</strong></summary>

This module manages **attendee registrations, ticket purchases, and check-in tracking**.

```mermaid
erDiagram

    ATTENDEE {
        UUID attendee_id PK
        string first_name
        string last_name
        string email
        string phone
    }

    TICKET_TYPE {
        UUID ticket_type_id PK
        UUID event_id FK
        string ticket_name
        decimal price
        integer total_quantity
    }

    EVENT_REGISTRATION {
        UUID registration_id PK
        UUID event_id FK
        UUID attendee_id FK
        UUID ticket_type_id FK
        datetime registration_date
        string status
    }

    CHECKIN_LOG {
        UUID checkin_id PK
        UUID registration_id FK
        datetime checkin_time
        string gate
    }

    ATTENDEE ||--o{ EVENT_REGISTRATION : registers
    TICKET_TYPE ||--o{ EVENT_REGISTRATION : selected
    EVENT_REGISTRATION ||--o{ CHECKIN_LOG : logs
```

</details>

---

<details>
<summary><strong>Finance & Budget Management Module</strong></summary>

This module manages **budget planning, payments, and expense tracking**.

```mermaid
erDiagram

    BUDGET {
        UUID budget_id PK
        UUID event_id FK
        decimal estimated_total
        decimal approved_total
        decimal actual_total
    }

    BUDGET_ITEM {
        UUID item_id PK
        UUID budget_id FK
        string category
        decimal estimated_amount
        decimal actual_amount
    }

    PAYMENT {
        UUID payment_id PK
        UUID registration_id FK
        decimal amount
        string payment_method
        string payment_status
        datetime payment_date
    }

    EXPENSE {
        UUID expense_id PK
        UUID event_id FK
        decimal amount
        string category
        date expense_date
    }

    BUDGET ||--o{ BUDGET_ITEM : contains
    EVENT ||--|| BUDGET : allocated
    EVENT ||--o{ EXPENSE : incurs
    EVENT_REGISTRATION ||--o{ PAYMENT : generates
```

</details>

---

# Final System Structure

| Module               | Purpose                                     |
| -------------------- | ------------------------------------------- |
| Authentication       | User authentication, roles, and permissions |
| Event Management     | Event creation, sessions, and scheduling    |
| Venue & Vendor       | Venue booking and vendor services           |
| Attendee & Ticketing | Registration, ticketing, and check-ins      |
| Finance & Budget     | Budget tracking, payments, and expenses     |

---

# Design Characteristics

The proposed system design demonstrates:

* Modular architecture
* Scalable microservice-oriented structure
* Normalized database schema
* Clear separation of concerns
* Real-world event management workflow support

