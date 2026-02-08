# Observability & Alerting

This service is designed to be fully observable through structured JSON logging to Loki/Grafana.

## Metrics

All metrics are emitted as structured info logs with a `metric` field.

### Request Metrics

**Success:**
```json
{
  "level": 30,
  "metric": "voice_request_success",
  "value": 1,
  "duration_ms": "2500",
  "language": "en"
}
```

**Error:**
```json
{
  "level": 30,
  "metric": "voice_request_error",
  "value": 1,
  "error_type": "whisper_failed",
  "duration_ms": "3000"
}
```

### Whisper Metrics

**Success:**
```json
{
  "metric": "whisper_transcription_success",
  "value": 1,
  "duration_ms": "2000",
  "language": "fi"
}
```

**Error:**
```json
{
  "metric": "whisper_transcription_error",
  "value": 1,
  "error_code": "WHISPER_AUTH_ERROR",
  "duration_ms": "200"
}
```

### Mail Metrics

**Success:**
```json
{
  "metric": "mail_send_success",
  "value": 1,
  "duration_ms": "1500"
}
```

**Error:**
```json
{
  "metric": "mail_send_error",
  "value": 1,
  "error_code": "MAIL_SMTP_CONNECTION_FAILED",
  "duration_ms": "5000"
}
```

### Auth & Validation Metrics

**Auth failure:**
```json
{
  "metric": "auth_failure",
  "value": 1,
  "reason": "invalid_token"
}
```

**Validation failure:**
```json
{
  "metric": "validation_failure",
  "value": 1,
  "reason": "missing_file"
}
```

## Loki Queries

### Request Success Rate (per second)

```
sum(rate({service="gtd-voice-capture", metric="voice_request_success"}[5m]))
```

### Request Error Rate

```
sum(rate({service="gtd-voice-capture", metric="voice_request_error"}[5m]))
```

### Whisper Failures by Error Code

```
sum(rate({service="gtd-voice-capture", metric="whisper_transcription_error"}[5m])) by (error_code)
```

### Email Failures

```
sum(rate({service="gtd-voice-capture", metric="mail_send_error"}[5m])) by (error_code)
```

### Average Transcription Latency

```
avg(({service="gtd-voice-capture", metric="whisper_transcription_success"}) | json | unwrap duration_ms)
```

### P95 Transcription Latency

```
histogram_quantile(0.95, ({service="gtd-voice-capture", metric="whisper_transcription_success"}) | json | unwrap duration_ms)
```

### Auth Failures Over Time

```
sum(rate({service="gtd-voice-capture", metric="auth_failure"}[5m])) by (reason)
```

### Service Startup Events

```
{service="gtd-voice-capture", component="bootstrap", msg="Service starting"}
```

### Error Summary (last 5 minutes)

```
{service="gtd-voice-capture", level="error"}
| json
| line_format "{{.component}}: {{.error}}"
```

## Grafana Dashboard

A pre-built dashboard is included: `grafana-dashboard.json`

**Panels:**
1. Request Success Rate (by language)
2. Error Rate (gauge)
3. Whisper Latency (by language)
4. Error Breakdown (Whisper + Mail)

**To import:**
1. Grafana UI → Dashboards → Import
2. Upload `grafana-dashboard.json`
3. Select Loki datasource
4. Save

## Alerts

Alert rules are provided in `grafana-alert-rules.yaml`.

### Critical Alerts

| Alert | Condition | Action |
|-------|-----------|--------|
| Service Restart Loop | >3 starts in 15m | Check logs for FATAL errors |
| Email Delivery Failure | >0.01 errors/sec for 5m | Check SMTP configuration |
| Whisper Failure Spike | >0.05 errors/sec for 2m | Check OpenAI API status |

### Warning Alerts

| Alert | Condition | Action |
|-------|-----------|--------|
| High Error Rate | >0.1 errors/sec for 5m | Investigate error logs |
| Auth Failures | >0.1/sec for 10m | Check API token, possible attacks |

### To Set Up Alerts

**Grafana Alerting:**
1. Grafana UI → Alerting → Create alert rule
2. Use Loki datasource
3. Use LogQL from `grafana-alert-rules.yaml`
4. Set notification channel

**Prometheus (with remote write):**
1. Scrape Loki metrics
2. Use rules from `grafana-alert-rules.yaml`
3. Trigger Alertmanager

## Key Metrics for On-Call

| Metric | Alert Threshold | Interpretation |
|--------|-----------------|-----------------|
| `voice_request_success` rate | <5/min | System might be down |
| `voice_request_error` rate | >0.1/sec | Systemic failure |
| `whisper_transcription_error` rate | >0.05/sec | OpenAI API issues |
| `mail_send_error` rate | >0/sec | SMTP broken |
| Service startup count | >3 in 15m | Crash loop |
| Error rate (level=error) | >0.1/sec | Operational issue |

## Log Levels & Alert Routing

| Level | Severity | Alert? | Routing |
|-------|----------|--------|---------|
| DEBUG (20) | Info | No | Development only |
| INFO (30) | Normal | No | Metrics, success logs |
| WARN (40) | Caution | No | Logged but not alerted |
| ERROR (50) | Problem | **Yes** | Alert, escalate |
| FATAL (60) | Critical | **Yes** | Page on-call |

## Querying Patterns

### Find all requests from a specific client

(Replace UUID with actual requestId)

```
{requestId="550e8400-e29b-41d4-a716-446655440000"}
| json
```

### Find requests with specific error

```
{service="gtd-voice-capture", level="error", component="whisper"}
| json
| error_code = "WHISPER_TIMEOUT"
```

### Find slow requests (>5 seconds)

```
{service="gtd-voice-capture", metric="voice_request_success"}
| json
| duration_ms > 5000
```

### Find language detection results

```
{service="gtd-voice-capture", metric="voice_request_success"}
| json
| line_format "{{.language}}: {{.duration_ms}}ms"
```

## Performance Baseline

Typical values (with valid API keys):

| Metric | Baseline | Alert Threshold |
|--------|----------|-----------------|
| Success latency | 2-3s | >10s = warn |
| Whisper latency | 1.5-2.5s | >5s = warn |
| Mail latency | 500-1500ms | >3s = warn |
| Error rate | 0/sec | >0.01 = alert |
| Success rate | >95% | <90% = alert |

## Custom Alerts

Create your own based on your SLO:

**Example: Alert if success rate drops below 95%**

```
sum(rate({service="gtd-voice-capture", metric="voice_request_success"}[5m]))
/
(sum(rate({service="gtd-voice-capture", metric="voice_request_success"}[5m])) + sum(rate({service="gtd-voice-capture", metric="voice_request_error"}[5m])))
< 0.95
```

## Debugging with Logs

### Service won't start

```
{service="gtd-voice-capture", level="fatal"}
| json
```

### High Whisper error rate

```
{service="gtd-voice-capture", metric="whisper_transcription_error"}
| json
| stats count() as errors by error_code
```

### Email delivery issues

```
{service="gtd-voice-capture", component="mail", level="error"}
| json
| line_format "{{.error_code}}: {{.message}}"
```

### Auth attack detection

```
{service="gtd-voice-capture", metric="auth_failure"}
| json
| stats count() as failures by reason
```

## Integration with Loki

Logs are automatically sent to stdout as JSON. Configure your container runtime to forward to Loki:

**Docker Compose (with Loki driver):**
```yaml
logging:
  driver: loki
  options:
    loki-url: http://loki:3100/loki/api/v1/push
    loki-external-labels: service=gtd-voice-capture,environment=prod
```

**Kubernetes (with Promtail):**
```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "3100"
```

**Systemd (with journald):**
```
journalctl -u gtd-voice-capture -f | nc loki:1514
```

## SLOs & Error Budgets

Recommended SLOs:

- **Availability:** 99.5% (uptime)
- **Latency:** 95% of requests <5s
- **Error Rate:** <0.1% of requests fail

Use the metrics to track these:

```
# Availability
sum(rate({service="gtd-voice-capture", metric="voice_request_success"}[5m]))
/
(sum(rate({service="gtd-voice-capture", metric="voice_request_success"}[5m])) + sum(rate({service="gtd-voice-capture", metric="voice_request_error"}[5m])))
```
