# EventZen ECS Structure Migration Guide

This guide explains how to change the current repository structure and deployment assumptions so they match the AWS ECS deployment plan documented in `EventZen_ECS_Deployment_Guide.pdf`.

## Migration Goal

Move from this model:

- Browser -> EC2 VM -> Nginx container -> Docker Compose services
- Local service discovery through Compose names such as `auth-service`, `mysql`, `mongodb`, `redis`, `kafka`, and `minio`
- Runtime secrets loaded from `.env.prod`

To this model:

- Browser -> Application Load Balancer -> ECS services
- One ECS service per deployable app container
- Service-to-service calls through ECS service discovery or explicit internal URLs
- Sensitive runtime configuration from AWS Secrets Manager
- Only public frontend build configuration kept outside Secrets Manager

## Final Production Deployment Boundary

Deploy these seven app containers to ECS:

- `frontend`
- `auth-service`
- `event-service`
- `venue-vendor-service`
- `ticketing-service`
- `finance-service`
- `notification-service`

Do not treat these Compose services as ECS application services in the current migration plan:

- `nginx`
- `mysql`
- `mongodb`
- `redis`
- `kafka`
- `zookeeper`
- `minio`
- `minio-init`
- `kafka-ui`
- `prometheus`
- `loki`
- `promtail`
- `tempo`
- `otel-collector`
- `grafana`

## Required Structural Changes

### 1. Remove Nginx from the Production Request Path

Current production Compose flow uses `nginx` as the entrypoint and [nginx/nginx.generated.conf](../../../nginx/nginx.generated.conf) owns API path routing.

For ECS production:

- the ALB becomes the only public entrypoint
- ALB listener rules replace Nginx path routing
- the `frontend` container becomes the default target for `/`
- backend services become direct ALB targets for their API paths

What to change:

- keep the Nginx config for local Docker if you still want it for local reverse proxy behavior
- stop treating the `nginx` container as part of the ECS deployment set
- mirror the existing route ownership in ALB listener rules

### 2. Split Local-Only Infrastructure from AWS-Backed Production Infrastructure

Right now [docker-compose.prod.yml](../../../docker-compose.prod.yml) mixes deployable app services with stateful and local infrastructure containers.

For ECS production, replace local infra dependencies with AWS-backed or separately managed endpoints:

- `mysql` -> Amazon RDS for MySQL
- `mongodb` -> Amazon DocumentDB or another managed Mongo-compatible deployment
- `redis` -> Amazon ElastiCache for Redis
- `kafka` -> Amazon MSK or another reachable Kafka broker
- `minio` -> Amazon S3 or an S3-compatible storage endpoint

What to change:

- keep local containerized infra for developer workflows
- stop relying on Compose hostnames like `mysql`, `mongodb`, `redis`, `kafka`, and `minio` in ECS
- parameterize production endpoints so ECS tasks can point at AWS resources

### 3. Replace Compose Service Discovery Assumptions

Current service URLs in Compose and ECS templates still assume Docker DNS names such as:

- `http://notification-service:8086`
- `http://event-service:8082`
- `http://ticketing-service:8084`
- `http://venue-vendor-service:8083`

In ECS, those names only work if you configure service discovery explicitly.

Choose one approach and standardize it across all services:

- AWS Cloud Map / ECS Service Connect internal DNS names
- explicit internal ALB URLs if you decide to route service-to-service traffic through ALB

Recommended direction for this repo:

- use ECS service discovery for internal service-to-service calls
- use ALB only for browser/public traffic

What to change:

- replace hardcoded Compose names in task-definition placeholder values with deployment-time service discovery names
- document one naming convention for all internal URLs

### 4. Move Backend Secrets Out of `.env.prod`

Current `.env.prod` contains sensitive runtime values such as:

- DB passwords
- JWT secrets
- SMTP credentials
- Firebase private key
- Razorpay secrets
- internal service keys

For ECS production:

- move sensitive values to AWS Secrets Manager
- keep non-secret wiring in ECS `environment`
- keep only public `VITE_*` frontend values as build-time config

Use [secrets-manager-mapping.md](./secrets-manager-mapping.md) as the key-level source of truth.

### 5. Keep Frontend Build-Time Config, but Remove Nginx Dependence

[frontend/Dockerfile](../../../frontend/Dockerfile) already bakes `VITE_*` variables into the build. That is compatible with the current deployment plan.

What must change is the assumption that production API traffic is rewritten by the Nginx container.

Recommended frontend production shape:

- `frontend` is built with public URLs or path-based URLs that resolve through ALB
- ALB forwards `/` to the frontend target group
- ALB forwards API paths directly to backend target groups

### 6. Keep Container Ports Stable

Do not change the container ports already used by the applications:

- `frontend` -> `80`
- `auth-service` -> `8081`
- `event-service` -> `8082`
- `venue-vendor-service` -> `8083`
- `ticketing-service` -> `8084`
- `finance-service` -> `8085`
- `notification-service` -> `8086`

These ports already match the ECS task definitions and the PDF deployment plan.

### 7. Treat `docker-compose.prod.yml` as a Local/Reference Artifact

Do not delete the Compose file. It is still useful as:

- the source of current runtime configuration
- the source of health check paths
- the source of service dependency relationships
- the source of route ownership currently implemented by Nginx

But for AWS deployment, the operational source of truth should become:

- task definitions in `backend/infrastructure/ecs/task-definitions/`
- ALB listener rules
- Secrets Manager entries
- GitHub Actions deployment metadata

## Recommended Repo Organization

Use this split:

- local Docker behavior: `docker-compose*.yml`, `nginx/`
- AWS deployment assets: `backend/infrastructure/ecs/`
- CI/CD deployment workflows: `.github/workflows/`

Within `backend/infrastructure/ecs/`, keep:

- task definitions
- secrets mapping
- compose-to-ECS mapping
- repo-specific migration checklist
- deployment checklist / rollout notes

## Implementation Checklist

1. Keep the existing seven ECS task definition templates and fill them with real AWS values.
2. Stop planning around the `nginx` Compose service for ECS production.
3. Move every backend secret from `.env.prod` into Secrets Manager.
4. Replace Compose infra endpoints with AWS-managed endpoints.
5. Replace Compose service hostnames with ECS service discovery names.
6. Mirror Nginx route ownership into ALB listener rules.
7. Deploy services one by one in dependency-aware order.

For this repository, use [repo-migration-checklist.md](./repo-migration-checklist.md) as the execution checklist that ties those steps to the current files and route ownership.

## Deployment Order

Recommended order from the deployment plan:

1. `notification-service`
2. `auth-service`
3. `venue-vendor-service`
4. `event-service`
5. `ticketing-service`
6. `finance-service`
7. `frontend`

## Practical Rule of Thumb

If a setting exists only because all containers used to live on one Docker network or one EC2 VM, it probably needs to be replaced for ECS.

That includes:

- Compose service names
- `depends_on` startup assumptions
- localhost-style or container-name-style infra connections
- reverse proxy behavior handled by the Nginx container
- `.env.prod` secrets injected directly into runtime containers
