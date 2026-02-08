import express, { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { httpLogger, logger, createRequestLogger } from './logger';
import { getConfig } from './config';
import { v4 as uuidv4 } from 'uuid';
import voiceRouter from './routes/voice';

// Graceful shutdown state
let isShuttingDown = false;

export function setShuttingDown(state: boolean) {
  isShuttingDown = state;
}

export function createServer() {
  const app = express();
  const config = getConfig();

  // Middleware
  app.use(httpLogger);

  // Graceful shutdown middleware - reject new requests during shutdown
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (isShuttingDown && req.path !== '/health') {
      const requestLog = createRequestLogger((req.id as string) || 'unknown');
      requestLog.warn({ component: 'http' }, 'Request rejected: service shutting down');
      return res.status(503).json({ ok: false, error: 'Service is shutting down' });
    }
    next();
  });

  // RequestId middleware (if not already set by pino-http)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.id as string) || uuidv4();
    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  });

  // Health endpoint - minimal liveness check
  app.get('/health', (req: Request, res: Response) => {
    if (isShuttingDown) {
      return res.status(503).json({ ok: false, shuttingDown: true });
    }
    res.json({ ok: true });
  });

  // Readiness endpoint - checks dependencies
  app.get('/ready', (req: Request, res: Response) => {
    const requestLog = createRequestLogger((req.id as string) || 'unknown');

    // Validate critical config
    const ready = !!(
      config.OPENAI_API_KEY &&
      config.OPENAI_BASE_URL &&
      config.SMTP_HOST &&
      config.SMTP_USER &&
      config.SMTP_PASS &&
      config.MAIL_FROM &&
      config.MAIL_TO &&
      config.INGEST_TOKEN
    );

    if (!ready) {
      requestLog.warn('Service not ready - missing configuration');
      return res.status(503).json({ ok: false, error: 'Service not ready' });
    }

    res.json({ ok: true });
  });

  // Voice capture route
  app.use('/voice', voiceRouter);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ ok: false, error: 'Not found' });
  });

  // Error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    const requestLog = createRequestLogger((req.id as string) || 'unknown');

    // Handle multer errors
    if (err instanceof MulterError) {
      requestLog.warn(
        { component: 'http', error: err.code, message: err.message },
        'Request rejected: multer validation error'
      );
      return res.status(400).json({ ok: false, error: 'Invalid file upload' });
    }

    // Handle custom validation errors (e.g., invalid mime type)
    if (err.message && err.message.startsWith('Invalid audio format')) {
      requestLog.warn(
        { component: 'http', error: err.message },
        'Request rejected: invalid audio format'
      );
      return res.status(400).json({ ok: false, error: err.message });
    }

    // Generic error handler
    requestLog.error(
      { component: 'http', error: err.message, stack: err.stack },
      'Unhandled error'
    );
    res.status(500).json({ ok: false, error: 'Internal server error' });
  });

  return app;
}
