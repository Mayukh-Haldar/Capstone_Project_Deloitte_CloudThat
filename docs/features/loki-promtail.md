[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 📋 Loki & Promtail

**Role:** Log Aggregation & Querying  
**Images:** `grafana/loki:3.2.1` · `grafana/promtail:3.2.1`  
**Category:** Advanced Infrastructure

---

## Overview

EventZen uses **Grafana Loki** for log aggregation and **Promtail** as the log shipping agent. Promtail tails Docker container log files on the host, attaches labels (service name, container ID), and ships them to Loki. Logs are then queryable in Grafana using **LogQL** alongside metrics and traces - enabling a fully correlated observability experience.

---

## Pipeline

```
Docker Container stdout/stderr
       │  (log files on host)
       ▼
Promtail (tail & label)
       │  HTTP push
       ▼
Loki (log store)
       │  LogQL queries
       ▼
Grafana (Explore / Dashboard panels)
```

---

## Configuration

| Component | Config File |
|-----------|-------------|
| Loki | `monitoring/loki/loki-config.yml` |
| Promtail | `monitoring/promtail/promtail-config.yml` |

## Labels Applied by Promtail

| Label | Value |
|-------|-------|
| `job` | Service name (e.g., `auth-service`) |
| `container` | Docker container name |
| `host` | Hostname |

---

## Correlation with Traces

When a service emits a log line that contains an OTel `trace_id`, Grafana can automatically link that log line to the corresponding distributed trace in Tempo - enabling jump-from-log-to-trace navigation in a single click.

---

## Example LogQL Queries

```logql
# All logs from auth-service
{job="auth-service"}

# Error logs across all services
{job=~".+"} |= "ERROR"

# Logs for a specific trace
{job="finance-service"} |= "trace_id=abc123"
```
