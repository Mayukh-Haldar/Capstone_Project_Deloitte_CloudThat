[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 🔭 OpenTelemetry & Tempo

**Role:** Distributed Tracing  
**Images:** `otel/opentelemetry-collector-contrib:0.111.0` · `grafana/tempo:2.6.1`  
**Category:** Advanced Infrastructure

---

## Overview

EventZen instruments every microservice with **OpenTelemetry (OTel)** to emit distributed traces. The **OpenTelemetry Collector** receives these traces over OTLP and forwards them to **Grafana Tempo** for storage and querying. Traces are visible in Grafana via the Tempo datasource, with full span correlation across service boundaries.

---

## Pipeline

```
Service (OTel SDK)
       │  OTLP (gRPC / HTTP)
       ▼
OTel Collector (otelcol-contrib)
       │  OTLP export
       ▼
Grafana Tempo
       │  TraceQL queries
       ▼
Grafana Dashboard
```

---

## Instrumentation per Service

| Service | OTel SDK | Auto-Instrumentation |
|---------|---------|---------------------|
| Auth Service | `opentelemetry-spring-boot-starter` | HTTP, JDBC, Spring MVC |
| Event Service | `opentelemetry-spring-boot-starter` | HTTP, JDBC, Spring MVC |
| Finance Service | `opentelemetry-spring-boot-starter` | HTTP, JDBC, Spring MVC |
| Ticketing Service | `opentelemetry-dotnet` | ASP.NET Core, HTTP client |
| Venue-Vendor Service | `@opentelemetry/sdk-node` | HTTP, Express, ioredis |
| Notification Service | `@opentelemetry/sdk-node` | HTTP, Express, KafkaJS |

---

## Collector Configuration

- Config file: `monitoring/otel-collector/otel-collector-config.yml`
- Receives traces on `0.0.0.0:4317` (gRPC) and `0.0.0.0:4318` (HTTP)
- Exports exclusively to Tempo (traces only - metrics go directly to Prometheus)

## Tempo Configuration

- Config file: `monitoring/tempo/tempo.yml`
- Storage: local filesystem (mounted volume)
- Retention: configurable
- Query endpoint consumed by Grafana datasource

---

## What You Can Trace

- Full request path: Nginx → Service A → Service B (internal HTTP call) → Database
- Kafka producer spans linked to consumer spans via trace context propagation
- Database query spans with SQL text (configurable)
- External HTTP calls (Razorpay, Firebase) as child spans
