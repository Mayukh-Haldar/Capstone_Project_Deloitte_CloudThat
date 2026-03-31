[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 🪑 Novelty Feature: Real-Time Seat Updates

**Service:** Ticketing Service (`backend/services/ticketing-service`) + Frontend  
**Category:** Novelty - Real-Time / Distributed State

---

## Overview

EventZen's seat selection screen shows a **live seat map** where every connected user sees seat availability update in real time - without polling. When one user reserves or releases a seat, all other users on the same event's seat map immediately see the change reflected. This prevents double-booking races and provides a truthful representation of availability to every concurrent buyer.

---

## How It Works

### Distributed Seat Locking (Backend)

1. When a user selects a seat, the Ticketing Service attempts to acquire a **distributed lock** on that seat record
2. The lock is backed by the `seat_reservations` table with a `reserved_until` TTL (e.g., 8 minutes)
3. A background job cleans up expired reservations, releasing seats back to the pool
4. This ensures that even if a user abandons checkout, the seat is eventually freed

### Real-Time Broadcast (SignalR)

5. The Ticketing Service hosts a **SignalR hub** that clients (the frontend seat map) connect to when opening the seat selection page for a specific event
6. When a seat status changes (reserved, confirmed, released, checked-in), the hub broadcasts the updated seat state to **all clients in that event's group**
7. The React frontend receives these messages and updates the seat map UI without a page reload

### Frontend Seat Map

8. Seats are colour-coded by status: Available (green) · Reserved/Locked (amber) · Booked (red) · User's own selection (blue)
9. On receiving a SignalR message, only the affected seat node re-renders (optimistic update pattern)
10. If checkout times out, the seat flips back to Available live on all connected screens

---

## Key Files

| File | Role |
|------|------|
| `backend/services/ticketing-service/.../Hubs/SeatHub.cs` | SignalR hub - group management and seat-status broadcast |
| `backend/services/ticketing-service/.../Services/SeatReservationService.cs` | Distributed lock logic and TTL management |
| `frontend/src/pages/SeatSelection.jsx` | SignalR client, seat map render, live update handler |

---

## Why It's Novel

- **Truly concurrent** - multiple users can safely browse the same seat map without stale data
- **No polling** - push-based updates via persistent WebSocket connection (SignalR)
- **Distributed lock with TTL** - guarantees eventual consistency even on abandoned sessions
- **Cross-service coordination** - Finance Service triggers seat confirmation after payment, propagating the final lock over the same SignalR channel
