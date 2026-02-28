/**
 * Express application factory.
 *
 * This file wires middleware, routes and global error handling in one place,
 * so server bootstrap logic stays minimal and focused.
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const { logger, morganStream } = require('./middleware/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const healthRoutes = require('./routes/healthRoutes');
const dataRoutes = require('./routes/dataRoutes');

dotenv.config();

const app = express();

const {
  API_PREFIX = '/api',
  RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000,
  RATE_LIMIT_MAX = 100,
  CORS_ORIGIN = '*',
  NODE_ENV = 'development'
} = process.env;

const logsDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Security headers hardening.
app.use(helmet());

// Trusted CORS boundary for frontend/IoT clients.
app.use(
  cors({
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map((entry) => entry.trim()),
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Rate-limit noisy clients to reduce abuse and accidental overload.
app.use(
  rateLimit({
    windowMs: Number(RATE_LIMIT_WINDOW_MS),
    max: Number(RATE_LIMIT_MAX),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Rate limit exceeded. Please retry later.'
    }
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP request logging for operational observability.
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev', { stream: morganStream }));

app.get('/', (_req, res) => {
  res.status(200).json({
    service: 'obruk-backend',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.use(`${API_PREFIX}/health`, healthRoutes);
app.use(`${API_PREFIX}/data`, dataRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

logger.info('Express app initialized', {
  apiPrefix: API_PREFIX,
  rateLimitWindowMs: Number(RATE_LIMIT_WINDOW_MS),
  rateLimitMax: Number(RATE_LIMIT_MAX)
});

module.exports = app;
