# Docker Deployment

## Quick Start

### 1. Build the image (in CI/CD or locally)

```bash
docker build -t gtd-voice-capture:latest .
```

For ARM64:
```bash
docker buildx build --platform linux/arm64 -t gtd-voice-capture:latest .
```

### 2. Add to your existing docker-compose.yml

Copy the service definition from `docker-compose.example.yml` and paste into your prod docker-compose:

```yaml
services:
  gtd-voice-capture:
    image: gtd-voice-capture:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      INGEST_TOKEN: ${INGEST_TOKEN}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT:-587}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      MAIL_FROM: ${MAIL_FROM}
      MAIL_TO: ${MAIL_TO}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
```

### 3. Create .env.prod (in your prod deploy location)

```bash
cp .env.prod.example .env.prod
# Edit with your actual secrets
```

### 4. Run

```bash
docker-compose up -d gtd-voice-capture
```

## Logging

All logs go to **stdout as JSON**:

```bash
docker logs -f gtd-voice-capture
```

For Loki integration, add to docker-compose:

```yaml
logging:
  driver: loki
  options:
    loki-url: http://loki:3100/loki/api/v1/push
    loki-external-labels: service=gtd-voice-capture
```

## Healthcheck

The container includes a health check:

```bash
docker inspect gtd-voice-capture --format='{{.State.Health.Status}}'
# Returns: healthy | unhealthy
```

Also manually:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

## Environment Variables

All required variables must be set. See `.env.prod.example`.

If any are missing, the container will:
1. Log a FATAL error with details
2. Exit with code 1
3. Not start again (unless restart policy is too aggressive)

## Networking

If your existing docker-compose uses a custom network:

```yaml
services:
  gtd-voice-capture:
    networks:
      - your_network

networks:
  your_network:
    external: true
```

## ARM64 Compatibility

The image is compatible with ARM64 (e.g., Raspberry Pi, cm3588).

Base image: `node:20-alpine` (multi-arch)

No additional platform-specific configuration needed.

## Non-root User

The container runs as `appuser` (uid 10000) for security.

If you mount volumes, ensure proper permissions:

```bash
chown -R 10000:10000 /path/to/mount
```

(Usually not needed—no volumes are mounted by default.)

## Graceful Shutdown

The container handles SIGTERM gracefully:

```bash
docker stop gtd-voice-capture
```

Will allow in-flight requests to complete before exiting (configurable timeout).

## Troubleshooting

### Container won't start

```bash
docker logs gtd-voice-capture
# Look for FATAL log entry with missing config
```

### Health check failing

```bash
# Check if service is up
docker exec gtd-voice-capture curl http://localhost:3000/health

# Check if dependencies are configured
docker exec gtd-voice-capture curl http://localhost:3000/ready
```

### High memory usage (shouldn't happen)

```bash
docker stats gtd-voice-capture
```

The service is minimal—expect < 100MB base + audio buffer.
