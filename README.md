# GTD Voice Capture

Minimal backend service that accepts audio recordings from an Apple Shortcut, transcribes them using OpenAI Whisper, and sends the transcription via email as a GTD inbox item.

## Features

- Auto-detect language (Finnish + English)
- Express.js HTTP API
- OpenAI Whisper integration
- SMTP email delivery
- Structured JSON logging (Pino)
- Request correlation via UUID
- Docker-ready (ARM64, multi-stage)
- Health & readiness endpoints

## Quick Start

### Development

```bash
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

### Production

```bash
npm install
npm run build
npm start
```

### Docker

```bash
docker build -t gtd-voice-capture .
docker run -p 3000:3000 --env-file .env gtd-voice-capture
```

## Configuration

Required environment variables:

- `INGEST_TOKEN` - API authentication token
- `OPENAI_API_KEY` - OpenAI API key for Whisper
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - Email configuration
- `MAIL_FROM`, `MAIL_TO` - Email addresses

See `.env.example` for all options.

## API

### POST /voice

Accept audio file and return transcription.

**Headers:**
```
Authorization: Bearer <INGEST_TOKEN>
```

**Body:**
```
multipart/form-data with 'file' field
```

**Response (success):**
```json
{
  "ok": true,
  "text": "Transcribed text here",
  "language": "fi"
}
```

**Response (error):**
```json
{
  "ok": false,
  "error": "Human-readable error"
}
```

### GET /health

Liveness check. Always returns 200 if process is alive.

### GET /ready

Readiness check. Returns 200 only if all dependencies are configured.

## Logging

All logs are output as structured JSON to stdout for easy ingestion by Loki/Grafana:

- `level`: log level (info, warn, error, fatal)
- `msg`: human-readable message
- `service`: service name
- `env`: environment (development/production)
- `component`: code component (http, auth, whisper, mail, bootstrap)
- `requestId`: UUID for request correlation

## Development Phases

- **Phase 0**: Scaffold & invariants (config, logging, health endpoints)
- **Phase 1**: Auth & HTTP contract (bearer token, multipart validation)
- **Phase 2**: Whisper integration (audio transcription)
- **Phase 3**: Email delivery (SMTP integration)
- **Phase 4**: Docker & prod hardening (graceful shutdown, load testing)
- **Phase 5**: Observability polish (metrics, Grafana dashboards)

## Architecture

```
Apple Shortcut (iOS)
  └─ Record Audio
  └─ HTTP POST /voice (multipart audio)
        ↓
Backend Service
  ├─ Receive audio
  ├─ Transcribe with OpenAI Whisper
  ├─ Send email via SMTP
  └─ Return JSON response
```

The Shortcut is intentionally dumb. All intelligence lives in the backend.

## License

MIT
