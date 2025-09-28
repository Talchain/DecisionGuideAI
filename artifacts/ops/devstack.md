# Development Stack Guide

This guide explains how to build and run the complete scenario platform locally using Docker.

## Quick Start

```bash
# Start the stack with remote images (default)
npm run devstack:up

# Start with locally built images
USE_LOCAL_IMAGES=1 npm run devstack:up

# Stop the stack
npm run devstack:down
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run devstack:up` | Start development stack |
| `npm run devstack:down` | Stop development stack with cleanup |

## Environment Variables

- `USE_LOCAL_IMAGES=1` - Build images locally instead of using remote ones
- `COMPOSE_PROJECT_NAME` - Docker Compose project name (default: `pilot`)

## Services

The stack includes these services:

### Core Services

1. **Gateway** (`localhost:3001`)
   - API gateway and request routing
   - CORS and security headers
   - Rate limiting and quotas

2. **Engine** (`localhost:3002`)
   - Scenario processing engine
   - Deterministic simulation mode
   - Token usage tracking

3. **Jobs** (`localhost:3003`)
   - Background job processing
   - Queue management
   - Status tracking

### Observability (Optional)

Enable with: `docker compose --profile observability up`

4. **Prometheus** (`localhost:9090`)
   - Metrics collection
   - Time series database

5. **Grafana** (`localhost:3000`)
   - Dashboards and visualisation
   - Default login: admin/pilot123

## Local Image Building

When `USE_LOCAL_IMAGES=1` is set, the following Dockerfiles are used:

- `docker/Dockerfile.gateway` - Gateway service
- `docker/Dockerfile.engine` - Engine service
- `docker/Dockerfile.jobs` - Jobs service

Each builds from the current repository state.

## Typical Workflows

### Development with Hot Reload

```bash
# Start stack in background
USE_LOCAL_IMAGES=1 npm run devstack:up

# Make code changes, then rebuild specific service
docker compose -f pilot-deploy/docker-compose.poc.yml build gateway
docker compose -f pilot-deploy/docker-compose.poc.yml up -d gateway

# View logs
docker compose -f pilot-deploy/docker-compose.poc.yml logs -f gateway
```

### Testing API Changes

```bash
# Start stack
npm run devstack:up

# Test gateway
curl http://localhost:3001/healthz

# Test engine
curl http://localhost:3002/healthz

# Test jobs
curl http://localhost:3003/healthz
```

### Full Reset

```bash
# Complete cleanup
npm run devstack:down
docker system prune -f
docker volume prune -f

# Fresh start
USE_LOCAL_IMAGES=1 npm run devstack:up
```

## Common Pitfalls

### Port Conflicts

If ports 3001-3003 are in use:

```bash
# Find what's using the ports
lsof -i :3001
lsof -i :3002
lsof -i :3003

# Kill conflicting processes
sudo lsof -ti:3001 | xargs kill -9
```

### Docker Issues

**"no space left on device":**
```bash
docker system prune -a
docker volume prune
```

**Build cache issues:**
```bash
docker compose -f pilot-deploy/docker-compose.poc.yml build --no-cache
```

**Permission denied:**
```bash
sudo chmod 666 /var/run/docker.sock
```

### Health Check Failures

Services may take 30-60 seconds to become healthy. Check logs:

```bash
docker compose -f pilot-deploy/docker-compose.poc.yml logs gateway
docker compose -f pilot-deploy/docker-compose.poc.yml ps
```

### Missing Dependencies

Ensure you have the required files:
- `package.json` and `package-lock.json`
- `tsconfig.json`
- Source code in `src/`
- Build scripts in `package.json`

## Debugging

### Service Logs

```bash
# All services
docker compose -f pilot-deploy/docker-compose.poc.yml logs -f

# Specific service
docker compose -f pilot-deploy/docker-compose.poc.yml logs -f gateway

# Last 100 lines
docker compose -f pilot-deploy/docker-compose.poc.yml logs --tail=100 gateway
```

### Container Inspection

```bash
# List containers
docker compose -f pilot-deploy/docker-compose.poc.yml ps

# Enter container
docker compose -f pilot-deploy/docker-compose.poc.yml exec gateway sh

# Check container resources
docker stats
```

### Network Issues

```bash
# Check network connectivity
docker compose -f pilot-deploy/docker-compose.poc.yml exec gateway ping engine
docker compose -f pilot-deploy/docker-compose.poc.yml exec gateway curl http://engine:3002/healthz
```

## Configuration

Default environment variables for each service are defined in `pilot-deploy/docker-compose.poc.yml`.

Key settings:
- All powerful features are **OFF** by default (rate limiting, cache, usage tracking, etc.)
- Simulation mode is **enabled** for safe development
- CORS allows `localhost:3000` and `localhost:5173`
- Log level is set to `info`

## Security Notes

- The development stack uses simulation mode with mock data
- No real API keys or secrets are required
- All monitoring and usage tracking is disabled by default
- CORS is configured for local development only