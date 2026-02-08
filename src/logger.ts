import pino from 'pino';
import pinoHttp from 'pino-http';
import { v4 as uuidv4 } from 'uuid';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  base: {
    service: 'gtd-voice-capture',
    env: process.env.NODE_ENV || 'development',
    version: process.env.SERVICE_VERSION || 'unknown',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const httpLogger = pinoHttp({
  logger: logger,
  genReqId: () => uuidv4(),
  customLogLevel: (req, res) => {
    if (res.statusCode >= 400) {
      return 'warn';
    }
    return 'info';
  },
});

export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}
