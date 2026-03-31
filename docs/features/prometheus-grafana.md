[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 📊 Prometheus & Grafana

**Role:** Metrics Collection, Alerting & Dashboards  
**Images:** `prom/prometheus:v2.55.1` · `grafana/grafana:11.3.0`  
**Category:** Advanced Infrastructure

---

## Overview

EventZen uses **Prometheus** for time-series metrics collection and **Grafana** for visualization. Every backend service exposes a `/metrics` endpoint in the Prometheus exposition format, and Prometheus scrapes them on a configurable interval. Grafana queries Prometheus (and Loki/Tempo) to render unified dashboards.

---

## Metrics Endpoints per Service

| Service | Metrics Endpoint | Library |
|---------|-----------------|---------|
| Auth Service | `/actuator/prometheus` | Micrometer |
| Event Service | `/actuator/prometheus` | Micrometer |
| Finance Service | `/actuator/prometheus` | Micrometer |
| Ticketing Service | `/metrics` | prometheus-net |
| Venue-Vendor Service | `/metrics` | prom-client |
| Notification Service | `/metrics` | prom-client |

---

## Prometheus Configuration

- Config file: `monitoring/prometheus/prometheus.yml`
- Scrape targets defined per service using internal Docker DNS names
- Scrape interval: configurable (default 15s)
- Prometheus UI available at `http://localhost:9090`

---

## Grafana Configuration

- Config directory: `monitoring/grafana/`
- **Datasources**: Prometheus, Loki, Tempo - provisioned automatically on container start
- **Dashboards**: Pre-provisioned JSON dashboards for service health, request rates, JVM metrics, and Node.js runtime
- Grafana UI available at `http://localhost:3308`

---

## Key Metrics Tracked

| Category | Metrics |
|----------|---------|
| HTTP | Request rate, latency percentiles (p50/p95/p99), error rate |
| JVM (Java) | Heap usage, GC pause duration, thread count |
| Node.js | Event loop lag, active handles, memory usage |
| .NET | GC collections, thread pool queue, request duration |
| Business | Registration count, payment success/fail rate, check-in rate |
