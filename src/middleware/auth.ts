import { Request, Response, NextFunction } from 'express';
import { getConfig } from '../config';
import { createRequestLogger } from '../logger';
import { recordAuthFailure } from '../metrics';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const config = getConfig();
  const requestLog = createRequestLogger((req.id as string) || 'unknown');

  // Extract Bearer token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    requestLog.warn({ component: 'auth', reason: 'missing_auth_header' }, 'Request rejected: missing or invalid auth header');
    recordAuthFailure('missing_auth_header');
    return res.status(401).json({ ok: false, error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Compare to configured token
  if (token !== config.INGEST_TOKEN) {
    requestLog.warn({ component: 'auth', reason: 'invalid_token' }, 'Request rejected: invalid token');
    recordAuthFailure('invalid_token');
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }

  // Token valid, continue
  requestLog.debug({ component: 'auth' }, 'Request authorized');
  next();
}
