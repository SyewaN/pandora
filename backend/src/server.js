/**
 * HTTP server bootstrapper.
 *
 * Handles startup and graceful shutdown signals so PM2/systemd restarts
 * do not leave dangling sockets or partial operations.
 */
const http = require('http');
const dotenv = require('dotenv');
const app = require('./app');
const { logger } = require('./middleware/logger');

dotenv.config();

const { PORT = 3000 } = process.env;

const server = http.createServer(app);

server.listen(PORT, () => {
  logger.info(`Backend server listening on port ${PORT}`);
});

const shutdown = (signal) => {
  logger.warn(`Received ${signal}. Starting graceful shutdown.`);

  server.close((error) => {
    if (error) {
      logger.error('Error while closing server', { message: error.message, stack: error.stack });
      process.exit(1);
    }

    logger.info('HTTP server closed successfully. Exiting process.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Graceful shutdown timeout reached. Forcing exit.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { message: error.message, stack: error.stack });
});
