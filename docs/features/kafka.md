[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 📨 Apache Kafka

**Role:** Asynchronous Event-Driven Communication  
**Image:** `confluentinc/cp-kafka:7.5.0`  
**Category:** Advanced Infrastructure

---

## Overview

EventZen uses **Apache Kafka** (Confluent Platform) for decoupled, asynchronous inter-service communication. Rather than services calling each other synchronously for every state change, the Event Service publishes domain events to Kafka topics and the Notification Service consumes them to trigger the appropriate notifications - ensuring services remain loosely coupled and independently deployable.

---

## Kafka Topics

| Topic | Producer | Consumer | Purpose |
|-------|---------|---------|---------|
| `event.updated` | Event Service | Notification Service | Notifies subscribers when an event's details change |
| `event.cancelled` | Event Service | Notification Service | Triggers cancellation notifications to all registered attendees |

---

## Architecture

```
Event Service                    Notification Service
      │                                  │
      │  publish(event.updated)          │
      ├─────────────────────────────────▶│  consume → send notifications
      │                                  │
      │  publish(event.cancelled)        │
      └─────────────────────────────────▶│  consume → send cancellations
                         │
                   Kafka Broker
               (confluentinc/cp-kafka)
                         │
                    Zookeeper
            (confluentinc/cp-zookeeper)
```

---

## Producer (Event Service)

- Uses Spring Kafka (`KafkaTemplate`) to publish serialized JSON event payloads
- Messages are keyed by `eventId` to ensure ordering within a partition for a given event

## Consumer (Notification Service)

- `kafkaConsumerService.js` uses **KafkaJS** to subscribe to both topics
- On message receipt, routes to the appropriate notification handler
- Commits offsets only after successful processing to avoid lost messages on restart

---

## Configuration

| Parameter | Value |
|-----------|-------|
| Broker | `kafka:9092` (internal Docker network) |
| Zookeeper | `zookeeper:2181` |
| Confluent version | 7.5.0 |
| UI | Kafka UI at `http://localhost:8091` (provectuslabs/kafka-ui) |
