import { z } from 'zod';
import { logger } from './logger';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Authentication
  INGEST_TOKEN: z.string().min(1, 'INGEST_TOKEN is required'),

  // OpenAI
  VOICE_API_KEY: z.string().min(1, 'VOICE_API_KEY is required'),

  // SMTP
  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().min(1, 'SMTP_USER is required'),
  SMTP_PASS: z.string().min(1, 'SMTP_PASS is required'),
  MAIL_FROM: z.string().email('MAIL_FROM must be a valid email'),
  MAIL_TO: z.string().email('MAIL_TO must be a valid email'),

  // Service metadata
  SERVICE_VERSION: z.string().default('unknown'),
});

export type Config = z.infer<typeof envSchema>;

let config: Config | null = null;

export function loadConfig(): Config {
  if (config) {
    return config;
  }

  try {
    config = envSchema.parse(process.env);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      logger.fatal({ errors }, 'Configuration validation failed');
      process.exit(1);
    }
    throw error;
  }
}

export function getConfig(): Config {
  if (!config) {
    throw new Error('Config not loaded. Call loadConfig() first.');
  }
  return config;
}
