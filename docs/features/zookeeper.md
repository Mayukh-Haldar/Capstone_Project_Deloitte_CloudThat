[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 🐘 Zookeeper

**Role:** Kafka Broker Coordination  
**Image:** `confluentinc/cp-zookeeper:7.5.0`  
**Category:** Advanced Infrastructure

---

## Overview

**Apache Zookeeper** is the distributed coordination service that Kafka (Confluent Platform 7.5.0) relies on for broker metadata management, leader election, and cluster state. In EventZen, Zookeeper runs as a dedicated container that Kafka connects to at startup.

---

## Role in EventZen

| Function | Description |
|----------|-------------|
| **Broker Registration** | Kafka brokers register themselves with Zookeeper on startup |
| **Leader Election** | Zookeeper coordinates which Kafka broker is the controller and which is the partition leader |
| **Topic Metadata** | Partition assignments, replica sets, and ISR (in-sync replica) lists are stored in Zookeeper |
| **Consumer Group Coordination** | Older Kafka clients use Zookeeper for consumer group offset storage (Confluent 7.5.0 still includes this path) |

---

## Configuration

| Parameter | Value |
|-----------|-------|
| Image | `confluentinc/cp-zookeeper:7.5.0` |
| Client port | `2181` |
| Internal host (Kafka) | `zookeeper:2181` |

---

## Note

Newer Kafka versions (KRaft mode, 3.x+) eliminate the Zookeeper dependency. EventZen uses Confluent 7.5.0 which still requires Zookeeper. This is intentional - it mirrors the production Confluent Cloud deployment model and provides operational familiarity with the full Confluent stack.
