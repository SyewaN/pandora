/**
 * Winston logger setup.
 *
 * Exposes both application logger and a stream adapter for Morgan.
 */
const path = require('path');
const fs = require('fs');
const { createLogger, format, transports } = require('winston');

const logsDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
  defaultMeta: { service: 'obruk-backend' },
  transports: [
    new transports.File({ filename: path.join(logsDir, 'backend-error.log'), level: 'error' }),
    new transports.File({ filename: path.join(logsDir, 'backend-combined.log') })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: format.combine(format.colorize(), format.simple())
    })
  );
}

const morganStream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = {
  logger,
  morganStream
};
