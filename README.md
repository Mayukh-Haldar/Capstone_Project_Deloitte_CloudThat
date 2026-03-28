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
- On Windows, Docker can fail to bind ports that fall inside excluded TCP ranges. `start-local.ps1` checks for that automatically and moves published ports to safe values when needed.

## Start The Full Stack

Recommended on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-local.ps1
```

This preflight script checks published host ports, avoids Windows excluded port ranges, rewrites `.env` when it finds a blocked port, and then starts Docker Compose.

Direct Docker Compose usage is still available:

```powershell
docker compose --env-file .env -f docker-compose.yml up -d --build
```

After startup, open `http://localhost/` when `NGINX_PORT=80`, or `http://localhost:<NGINX_PORT>/` if the preflight had to move nginx to another host port.

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
- The app is served through nginx on the host port configured by `NGINX_PORT`, so the frontend and API routes are available from `http://localhost:<NGINX_PORT>/`.
