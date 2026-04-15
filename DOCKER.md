# Docker Deployment Guide

## Quick Start

### Pull from Docker Hub

```bash
docker pull zlomerovic/firebird-web-client:latest
docker pull zlomerovic/firebird-web-server:latest
```

### Docker Compose (Recommended)

Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  server:
    image: zlomerovic/firebird-web-server:latest
    container_name: firebird-web-server
    environment:
      - PORT=3001
      - CORS_ORIGIN=*
    expose:
      - "3001"
    restart: unless-stopped

  client:
    image: zlomerovic/firebird-web-client:latest
    container_name: firebird-web-client
    ports:
      - "6969:80"
    depends_on:
      - server
    restart: unless-stopped
```

```bash
docker compose up -d
```

Open http://localhost:6969

### With a Firebird Database

To run a complete stack including a Firebird database:

```yaml
version: '3.8'

services:
  firebird:
    image: jacobalberty/firebird:v5
    container_name: firebird-db
    environment:
      - FIREBIRD_DATABASE=mydb.fdb
      - FIREBIRD_USER=SYSDBA
      - ISC_PASSWORD=masterkey
    volumes:
      - firebird-data:/firebird/data
    expose:
      - "3050"
    restart: unless-stopped

  server:
    image: zlomerovic/firebird-web-server:latest
    container_name: firebird-web-server
    environment:
      - PORT=3001
      - CORS_ORIGIN=*
    expose:
      - "3001"
    depends_on:
      - firebird
    restart: unless-stopped

  client:
    image: zlomerovic/firebird-web-client:latest
    container_name: firebird-web-client
    ports:
      - "6969:80"
    depends_on:
      - server
    restart: unless-stopped

volumes:
  firebird-data:
```

```bash
docker compose up -d
```

Then connect in the UI with:
- **Host**: `firebird` (the Docker service name)
- **Port**: `3050`
- **User**: `SYSDBA`
- **Password**: `masterkey`
- **Database**: `mydb.fdb` (or leave empty to browse available databases)

---

## Configuration

### Server Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API server port |
| `CORS_ORIGIN` | `*` | Allowed CORS origins (set to specific domain in production) |

### Client (nginx)

The client container serves the built React app via nginx and proxies `/api/*` requests to the server container. The nginx config expects the server to be reachable at `http://server:3001` (the Docker Compose service name).

If you need to customize the nginx config, mount your own:

```yaml
client:
  image: zlomerovic/firebird-web-client:latest
  volumes:
    - ./my-nginx.conf:/etc/nginx/conf.d/default.conf
  ports:
    - "6969:80"
```

### Custom Port

To change the exposed port:

```yaml
client:
  ports:
    - "8080:80"  # Access at http://localhost:8080
```

---

## Building from Source

If you prefer to build the Docker images yourself:

```bash
git clone https://github.com/ZlatanOmerovic/firebird-web-client.git
cd firebird-web-client

# Build both images
docker compose build

# Run
docker compose up -d
```

Or build individually:

```bash
# Server
docker build -t firebird-web-server ./server

# Client
docker build -t firebird-web-client ./client
```

---

## Architecture

```
┌─────────────────────────────────────┐
│            Client (nginx)           │
│         http://localhost:6969       │
│                                     │
│  ┌─────────┐    ┌───────────────┐  │
│  │  React   │    │  nginx proxy  │  │
│  │  SPA     │───>│  /api/* ──────│──┼──> Server (Node.js)
│  │  :80     │    │               │  │    :3001
│  └─────────┘    └───────────────┘  │
└─────────────────────────────────────┘
                                          │
                                          ▼
                                    ┌───────────┐
                                    │  Firebird  │
                                    │  Database  │
                                    │  :3050     │
                                    └───────────┘
```

- **Client container**: nginx serves the React SPA and proxies API requests to the server
- **Server container**: Node.js/Fastify handles all database operations via the `node-firebird` wire protocol
- **Firebird**: Your existing Firebird server (can be another container, a local install, or a remote server)

---

## Connecting to External Firebird

The web client can connect to any Firebird server reachable from the Docker network. For a Firebird server running on your host machine:

```yaml
server:
  image: zlomerovic/firebird-web-server:latest
  extra_hosts:
    - "host.docker.internal:host-gateway"
```

Then connect with host `host.docker.internal` in the UI.

---

## Troubleshooting

### "Connection refused" when connecting to Firebird

- Ensure Firebird is running and the port is accessible
- If Firebird is in Docker, make sure both containers are on the same Docker network
- Use the Docker service name (e.g., `firebird`) as the host, not `localhost`

### Client shows "Server Offline"

- Check if the server container is running: `docker compose ps`
- Check server logs: `docker compose logs server`
- The nginx config expects the server at `http://server:3001` — ensure the service name matches

### "Wire encryption" or "Auth plugin" errors

For Firebird 4+/5+, you may need to configure wire encryption:

```bash
# In your Firebird container, set:
docker exec firebird-db bash -c 'echo "WireCrypt = Enabled" >> /firebird/etc/firebird.conf'
docker restart firebird-db
```

### Viewing logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f server
docker compose logs -f client
```

### Updating

```bash
docker compose pull
docker compose up -d
```

---

## Version Pinning

For production, pin to a specific version instead of `latest`:

```yaml
server:
  image: zlomerovic/firebird-web-server:0.0.1-beta
client:
  image: zlomerovic/firebird-web-client:0.0.1-beta
```

Check available tags at:
- https://hub.docker.com/r/zlomerovic/firebird-web-server/tags
- https://hub.docker.com/r/zlomerovic/firebird-web-client/tags
