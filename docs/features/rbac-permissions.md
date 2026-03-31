[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 🛡️ RBAC & Permissions System

## Overview

EventZen implements a **Role-Based Access Control (RBAC)** model with a fine-grained permission layer. Rather than hard-coding what each role can do, the system stores a `permissions` table and a `role_permissions` join table - so permissions can be updated without changing application code. Spring Security's `@PreAuthorize` checks are backed by these DB-driven assignments.

---

## Role Hierarchy

| Role | Description |
|---|---|
| `ADMIN` | Platform administrator with full access |
| `ORGANIZER` | Event organizer with event and finance access |
| `VENDOR` | Venue vendor with limited event and venue visibility |
| `ATTENDEE` | Customer account for registration and ticketing |

Roles are stored in a `roles` table keyed by `RoleName` enum; each user's role assignments live in `user_roles`.

---

## Permission Model

Every permission has three dimensions:

```
Permission
├── name           Unique string key  e.g. "event.create"
├── module         Application area   e.g. "EVENT", "FINANCE", "USER"
├── action         CRUD verb          e.g. "CREATE", "READ", "UPDATE", "DELETE"
└── resource_type  Target entity      e.g. "Event", "Budget", "Ticket"
```

This design allows future UI-level permission checks (e.g. hiding a button if user lacks `event.create`) without code changes.

---

## Database Schema

```
roles
├── role_id     UUID PK
├── role_name   VARCHAR(50) UNIQUE   ADMIN | ORGANIZER | VENDOR | ATTENDEE
└── description VARCHAR(255)

permissions
├── permission_id   UUID PK
├── permission_name VARCHAR(100) UNIQUE
├── module          VARCHAR(100)
├── action          VARCHAR(100)
└── resource_type   VARCHAR(100)

role_permissions
├── id            UUID PK
├── role_id       UUID FK → roles
└── permission_id UUID FK → permissions

user_roles
├── id      UUID PK
├── user_id UUID FK → users
└── role_id UUID FK → roles
```

---

## Key Source Files

| File | Purpose |
|---|---|
| `Role.java` | JPA entity - `id`, `RoleName`, `description` |
| `Permission.java` | JPA entity - `name`, `module`, `action`, `resourceType` |
| `RolePermission.java` | JPA join entity - links a `Role` to a `Permission` |
| `UserRole.java` | JPA join entity - links a `User` to a `Role` |
| `RoleName.java` | Enum with `ADMIN`, `ORGANIZER`, `VENDOR`, `ATTENDEE` |

---

## How Spring Security Uses It

When a JWT is validated, the `AuthenticatedUser` principal is populated with the user's granted authorities (derived from their role assignments). Spring Security's `@PreAuthorize` annotations on controllers then enforce access:

```java
@PreAuthorize("hasRole('ADMIN')")
public void deleteUser(...) { ... }

@PreAuthorize("hasAnyRole('ADMIN', 'ORGANIZER')")
public EventResponse createEvent(...) { ... }

@PreAuthorize("hasAnyRole('ADMIN', 'ORGANIZER', 'VENDOR')")
public VenueResponse getVenue(...) { ... }
```

---

## Seeded Permissions

The `DataInitializer` runs at startup and seeds both roles and a full set of permissions into the DB if they don't already exist - ensuring the system is always correctly configured even on a fresh deploy.

---

## Security Notes

- **Method-level security** is enabled via `@EnableMethodSecurity` - every sensitive endpoint is protected
- **Role escalation** is prevented - users cannot assign roles to themselves; only admins can grant roles through the Account Request workflow
- **No wildcard permissions** - every permission is explicit `module + action + resource_type`
