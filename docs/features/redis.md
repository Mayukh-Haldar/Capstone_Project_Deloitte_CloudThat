[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 🟥 Redis

**Role:** Distributed Caching & Rate-Limiting Store  
**Image:** `redis:7-alpine`  
**Category:** Advanced Infrastructure

---

## Overview

EventZen uses **Redis** as a fast in-memory data store within the Notification Service. Redis provides the backing layer for the internal notification delivery queue and acts as a shared state store for rate limiting and deduplication across service instances.

---

## Usage in EventZen

| Usage | Details |
|-------|---------|
| **Notification Queue** | `queueService.js` uses Redis as the backing store for the internal queue that serializes and orders notification dispatch jobs |
| **Rate Limiting** | Prevents notification flood - per-user, per-channel delivery rate tracked in Redis with TTL-based counters |
| **Deduplication** | Tracks recently processed Kafka message IDs to prevent duplicate notification sends on consumer restart |
| **Session Store** | Optional: short-lived token state for partial auth flows (e.g., MFA-pending sessions) |

---

## Configuration

| Parameter | Value |
|-----------|-------|
| Image | `redis:7-alpine` |
| Internal host | `redis:6379` |
| Connection (Notification Service) | `REDIS_URL=redis://redis:6379` |
| Client library | `ioredis` v5 |

---

## Why Redis over a Message Queue

Redis is used here for **lightweight, in-process queuing** within the Notification Service rather than a full message broker. Kafka handles cross-service event streaming; Redis handles intra-service job coordination and ephemeral state - keeping each tool in its appropriate scope.
