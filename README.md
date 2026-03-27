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

Important:

- Use the root `.env` file for Docker Compose.
- Containers connect to MongoDB on `mongodb:27017`.
- If you connect to MongoDB from your host machine, use `localhost:27018`.

## Start The Full Stack

```powershell
docker compose --env-file .env -f docker-compose.yml up -d --build
```

After startup, open `http://localhost/`.

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

To inspect a single service:

```powershell
docker compose --env-file .env -f docker-compose.yml logs -f auth-service
docker compose --env-file .env -f docker-compose.yml logs -f venue-vendor-service
docker compose --env-file .env -f docker-compose.yml logs -f ticketing-service
```

## Notes

- This branch is intended to run the full platform through Docker Compose.
- The root compose file brings up the frontend, nginx, backend services, databases, monitoring, and supporting containers.
- The app is served through nginx on port `80`, so the frontend and API routes are available from `http://localhost/`.
