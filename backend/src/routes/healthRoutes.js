/**
 * Health route.
 *
 * Combines local backend status with AI service status in one endpoint.
 */
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { getAiHealth } = require('../services/aiService');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const aiHealth = await getAiHealth();

    res.status(200).json({
      success: true,
      backend: {
        service: 'obruk-backend',
        status: 'healthy',
        uptimeSeconds: process.uptime(),
        timestamp: new Date().toISOString()
      },
      ai: aiHealth
    });
  })
);

module.exports = router;
