import 'dotenv/config';
import { loadConfig, getConfig } from './config';
import { logger } from './logger';
import { createServer, setShuttingDown } from './server';
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
          env: config.NODE_ENV,
          version: config.SERVICE_VERSION,
        },
        'Server listening'
      );
    });

    // Graceful shutdown handler
    const handleShutdown = (signal: string) => {
      logger.info(
        {
          component: 'bootstrap',
          signal,
        },
        'Shutdown signal received, rejecting new requests'
      );

      // Stop accepting new requests
      setShuttingDown(true);

      // Give in-flight requests time to complete (30 seconds)
      const shutdownTimeout = setTimeout(() => {
        logger.warn(
          { component: 'bootstrap' },
          'Shutdown timeout reached, force closing'
        );
        process.exit(1);
      }, 30000);

      // Close server and wait for connections to drain
      server.close(() => {
        clearTimeout(shutdownTimeout);
        logger.info({ component: 'bootstrap' }, 'Server closed gracefully');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (error) {
    logger.fatal({ error }, 'Failed to start service');
    process.exit(1);
  }
}

main();
