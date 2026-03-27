# EventZen

Root-level quick start for the `EXPORT_GITHUB_DOCKER` branch.

## Prerequisites

- Docker Desktop
- Docker Compose
- A local `.env` file copied from `.env.example`

## Setup

```powershell
Copy-Item .env.example .env
```

Update the values in `.env` before starting the stack.

Nginx is loaded directly from `backend/docker/nginx/nginx.conf`, so no separate root-level `nginx` folder is needed.

## Start The Full Stack

```powershell
docker compose --env-file .env -f docker-compose.yml up -d --build
```

## Stop The Full Stack

```powershell
docker compose --env-file .env -f docker-compose.yml down --remove-orphans
```

## Useful Commands

```powershell
docker compose --env-file .env -f docker-compose.yml ps
docker compose --env-file .env -f docker-compose.yml logs -f
docker compose --env-file .env -f docker-compose.yml restart
```

## Notes

- This branch is intended to run the full platform through Docker Compose.
- The root compose file brings up the frontend, nginx, backend services, databases, monitoring, and supporting containers.
