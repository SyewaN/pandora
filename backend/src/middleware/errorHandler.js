/**
 * Global error middleware collection.
 */
const { logger } = require('./logger');

/**
 * Handles unknown routes.
 */
const notFoundHandler = (req, res, _next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
};

/**
 * Sends consistent error responses and logs stack traces.
 */
const errorHandler = (error, req, res, _next) => {
  const statusCode = error.statusCode || 500;

  logger.error('Request failed', {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    message: error.message,
    stack: error.stack
  });

  res.status(statusCode).json({
    success: false,
    message: error.message || 'Internal server error'
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
