import { logger } from './logger';

/**
 * Metrics emitted as structured logs for Loki aggregation
 * Grafana can query: {metric="voice_request_success"}
 */

export interface MetricEvent {
  metric: string;
  value: number;
  tags?: Record<string, string>;
}

export function emitMetric(event: MetricEvent): void {
  logger.info(
    {
      metric: event.metric,
      value: event.value,
      ...event.tags,
    },
    `Metric: ${event.metric}`
  );
}

/**
 * Request metrics
 */
export function recordRequestSuccess(duration: number, language?: string): void {
  emitMetric({
    metric: 'voice_request_success',
    value: 1,
    tags: {
      duration_ms: duration.toString(),
      language: language || 'unknown',
    },
  });
}

export function recordRequestError(errorType: string, duration: number): void {
  emitMetric({
    metric: 'voice_request_error',
    value: 1,
    tags: {
      error_type: errorType,
      duration_ms: duration.toString(),
    },
  });
}

/**
 * Whisper metrics
 */
export function recordWhisperSuccess(duration: number, language?: string): void {
  emitMetric({
    metric: 'whisper_transcription_success',
    value: 1,
    tags: {
      duration_ms: duration.toString(),
      language: language || 'unknown',
    },
  });
}

export function recordWhisperError(errorCode: string, duration: number): void {
  emitMetric({
    metric: 'whisper_transcription_error',
    value: 1,
    tags: {
      error_code: errorCode,
      duration_ms: duration.toString(),
    },
  });
}

/**
 * Mail metrics
 */
export function recordMailSuccess(duration: number): void {
  emitMetric({
    metric: 'mail_send_success',
    value: 1,
    tags: {
      duration_ms: duration.toString(),
    },
  });
}

export function recordMailError(errorCode: string, duration: number): void {
  emitMetric({
    metric: 'mail_send_error',
    value: 1,
    tags: {
      error_code: errorCode,
      duration_ms: duration.toString(),
    },
  });
}

/**
 * Auth metrics
 */
export function recordAuthFailure(reason: string): void {
  emitMetric({
    metric: 'auth_failure',
    value: 1,
    tags: {
      reason,
    },
  });
}

/**
 * Validation metrics
 */
export function recordValidationFailure(reason: string): void {
  emitMetric({
    metric: 'validation_failure',
    value: 1,
    tags: {
      reason,
    },
  });
}
