/**
 * Sensor data routes.
 */
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { validateSensorPayload } = require('../middleware/validator');
const {
  saveMeasurement,
  getPaginatedMeasurements,
  getLatestMeasurement,
  getLatestSequence,
  getStats
} = require('../services/dataService');
const { predict } = require('../services/aiService');
const { logger } = require('../middleware/logger');

const router = express.Router();

router.post(
  '/',
  validateSensorPayload,
  asyncHandler(async (req, res) => {
    const measurement = req.body;

    await saveMeasurement(measurement);

    const sequence = await getLatestSequence(Number(process.env.AI_SEQUENCE_LENGTH || 10));
    const aiPrediction = await predict(sequence);

    res.status(201).json({
      success: true,
      message: 'Measurement saved and analyzed successfully.',
      measurement,
      aiPrediction
    });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const result = await getPaginatedMeasurements({ page, limit });

    res.status(200).json({
      success: true,
      ...result
    });
  })
);

router.get(
  '/latest',
  asyncHandler(async (_req, res) => {
    const latest = await getLatestMeasurement();

    if (!latest) {
      return res.status(404).json({
        success: false,
        message: 'No measurement found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: latest
    });
  })
);

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const stats = await getStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  })
);

router.use((error, _req, _res, next) => {
  logger.error('Data route error', { message: error.message });
  next(error);
});

module.exports = router;
