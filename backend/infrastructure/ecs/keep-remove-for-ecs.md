# EventZen Keep Or Remove For ECS

This document lists exactly what stays in the ECS production app plane and what must be removed from it.

## Keep In ECS Production

- `frontend`
- `auth-service`
- `event-service`
- `venue-vendor-service`
- `ticketing-service`
- `finance-service`
- `notification-service`
- ECS task definitions in `backend/infrastructure/ecs/task-definitions/`
- ALB listener rules and target groups
- AWS Secrets Manager entries for backend secrets
- ECS service discovery naming through Cloud Map or Service Connect

## Remove From The ECS App Plane

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

## Keep For Local Or Reference Use Only

- `docker-compose.prod.yml`
- `nginx/nginx.generated.conf`
- local Docker-based infrastructure and startup assumptions

## Replace With AWS-Managed Or Separately Managed Infrastructure

- `mysql` -> Amazon RDS for MySQL
- `mongodb` -> Amazon DocumentDB or another Mongo-compatible deployment
- `redis` -> Amazon ElastiCache for Redis
- `kafka` -> Amazon MSK or another managed Kafka broker
- `minio` -> Amazon S3 or another S3-compatible storage endpoint

## Do Not Carry These Compose Assumptions Into ECS

- `depends_on`
- Docker Compose DNS hostnames
- local container-name infrastructure URLs
- reverse proxy behavior handled by the `nginx` container
- backend secrets loaded directly from `.env.prod`
