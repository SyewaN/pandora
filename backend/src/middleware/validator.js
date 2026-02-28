/**
 * Sensor data validator middleware.
 *
 * Validates payload structure and expected value ranges:
 * - tds: 0..5000
 * - temperature: -20..60
 * - moisture: 0..1000
 */

/**
 * Ensures the incoming body matches expected schema.
 */
const validateSensorPayload = (req, res, next) => {
  try {
    const { tds, temperature, moisture, timestamp } = req.body;
    const errors = [];

    if (!Number.isFinite(tds) || tds < 0 || tds > 5000) {
      errors.push('`tds` must be a number between 0 and 5000.');
    }

    if (!Number.isFinite(temperature) || temperature < -20 || temperature > 60) {
      errors.push('`temperature` must be a number between -20 and 60.');
    }

    if (!Number.isFinite(moisture) || moisture < 0 || moisture > 1000) {
      errors.push('`moisture` must be a number between 0 and 1000.');
    }

    if (timestamp && Number.isNaN(Date.parse(timestamp))) {
      errors.push('`timestamp` must be a valid ISO date string when provided.');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    req.body = {
      tds: Number(tds),
      temperature: Number(temperature),
      moisture: Number(moisture),
      timestamp: timestamp || new Date().toISOString()
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  validateSensorPayload
};
