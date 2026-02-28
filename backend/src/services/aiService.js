/**
 * AI integration service.
 *
 * Provides a typed gateway from backend to Flask endpoints.
 */
const axios = require('axios');
const { logger } = require('../middleware/logger');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5000';
const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 5000);

const client = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: AI_REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Returns AI service health when available.
 */
const getAiHealth = async () => {
  try {
    const { data } = await client.get('/health');
    return { healthy: true, ...data };
  } catch (error) {
    logger.error('AI health check failed', { message: error.message });
    return {
      healthy: false,
      error: error.message
    };
  }
};

/**
 * Requests forecast + anomaly score from AI service.
 */
const predict = async (sequence) => {
  try {
    const { data } = await client.post('/predict', { sequence });
    logger.info('AI prediction completed', {
      sequenceLength: Array.isArray(sequence) ? sequence.length : 0,
      mode: data.mode
    });
    return data;
  } catch (error) {
    logger.error('AI prediction request failed', { message: error.message });
    throw new Error(`AI prediction failed: ${error.message}`);
  }
};

module.exports = {
  getAiHealth,
  predict
};
