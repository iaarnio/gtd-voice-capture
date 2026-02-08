import 'dotenv/config';
import { loadConfig, getConfig } from './config';
import { logger } from './logger';
import { createServer } from './server';
import { initializeMailer } from './services/mail';

async function main() {
  try {
    // Load and validate configuration
    loadConfig();
    const config = getConfig();

    // Initialize mail service
    initializeMailer();

    // Log startup
    logger.info(
      {
        component: 'bootstrap',
        version: config.SERVICE_VERSION,
        env: config.NODE_ENV,
        port: config.PORT,
      },
      'Service starting'
    );

    // Create and start server
    const app = createServer();
    const server = app.listen(config.PORT, () => {
      logger.info(
        {
          component: 'bootstrap',
          port: config.PORT,
        },
        'Server listening'
      );
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info({ component: 'bootstrap' }, 'SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info({ component: 'bootstrap' }, 'Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info({ component: 'bootstrap' }, 'SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info({ component: 'bootstrap' }, 'Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.fatal({ error }, 'Failed to start service');
    process.exit(1);
  }
}

main();
