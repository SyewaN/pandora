/**
 * JSON-backed data persistence service.
 *
 * This service keeps a simple file-based store suitable for edge deployments
 * or PoC environments where a full database is not required yet.
 */
const fs = require('fs/promises');
const path = require('path');
const { logger } = require('../middleware/logger');

const DATA_FILE_PATH = process.env.DATA_FILE_PATH || './data/measurements.json';
const resolvedDataFilePath = path.resolve(process.cwd(), DATA_FILE_PATH);

/**
 * Ensures that the JSON file exists and starts with an array payload.
 */
const ensureDataFile = async () => {
  try {
    await fs.access(resolvedDataFilePath);
  } catch (_error) {
    await fs.mkdir(path.dirname(resolvedDataFilePath), { recursive: true });
    await fs.writeFile(resolvedDataFilePath, '[]', 'utf-8');
    logger.warn('Data file was missing and has been initialized.', { filePath: resolvedDataFilePath });
  }
};

/**
 * Reads all measurement records from disk.
 * @returns {Promise<Array<object>>}
 */
const readAllMeasurements = async () => {
  await ensureDataFile();

  try {
    const raw = await fs.readFile(resolvedDataFilePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.error('Failed to read measurement data', { message: error.message });
    throw error;
  }
};

/**
 * Atomically writes all records to disk.
 * @param {Array<object>} measurements
 */
const writeAllMeasurements = async (measurements) => {
  try {
    await fs.writeFile(resolvedDataFilePath, JSON.stringify(measurements, null, 2), 'utf-8');
  } catch (error) {
    logger.error('Failed to write measurement data', { message: error.message });
    throw error;
  }
};

/**
 * Appends a new record and persists it.
 * @param {object} measurement
 */
const saveMeasurement = async (measurement) => {
  const all = await readAllMeasurements();
  all.push(measurement);
  await writeAllMeasurements(all);
  logger.info('Measurement saved', { timestamp: measurement.timestamp });
  return measurement;
};

/**
 * Retrieves records with pagination metadata.
 */
const getPaginatedMeasurements = async ({ page = 1, limit = 20 }) => {
  const all = await readAllMeasurements();
  const safePage = Math.max(1, Number(page));
  const safeLimit = Math.max(1, Math.min(200, Number(limit)));

  const startIndex = (safePage - 1) * safeLimit;
  const items = all.slice(startIndex, startIndex + safeLimit);

  return {
    page: safePage,
    limit: safeLimit,
    total: all.length,
    totalPages: Math.ceil(all.length / safeLimit) || 1,
    items
  };
};

/**
 * Returns the last recorded measurement if present.
 */
const getLatestMeasurement = async () => {
  const all = await readAllMeasurements();
  return all.length > 0 ? all[all.length - 1] : null;
};

/**
 * Returns the most recent N measurements for model input.
 */
const getLatestSequence = async (count = 10) => {
  const all = await readAllMeasurements();
  return all.slice(Math.max(0, all.length - count));
};

/**
 * Aggregates min/max/avg stats for each metric.
 */
const getStats = async () => {
  const all = await readAllMeasurements();

  if (all.length === 0) {
    return {
      count: 0,
      tds: { min: null, max: null, avg: null },
      temperature: { min: null, max: null, avg: null },
      moisture: { min: null, max: null, avg: null }
    };
  }

  const initial = {
    tds: { min: Infinity, max: -Infinity, sum: 0 },
    temperature: { min: Infinity, max: -Infinity, sum: 0 },
    moisture: { min: Infinity, max: -Infinity, sum: 0 }
  };

  const aggregated = all.reduce((acc, item) => {
    ['tds', 'temperature', 'moisture'].forEach((key) => {
      acc[key].min = Math.min(acc[key].min, item[key]);
      acc[key].max = Math.max(acc[key].max, item[key]);
      acc[key].sum += item[key];
    });
    return acc;
  }, initial);

  return {
    count: all.length,
    tds: {
      min: aggregated.tds.min,
      max: aggregated.tds.max,
      avg: Number((aggregated.tds.sum / all.length).toFixed(2))
    },
    temperature: {
      min: aggregated.temperature.min,
      max: aggregated.temperature.max,
      avg: Number((aggregated.temperature.sum / all.length).toFixed(2))
    },
    moisture: {
      min: aggregated.moisture.min,
      max: aggregated.moisture.max,
      avg: Number((aggregated.moisture.sum / all.length).toFixed(2))
    }
  };
};

module.exports = {
  readAllMeasurements,
  saveMeasurement,
  getPaginatedMeasurements,
  getLatestMeasurement,
  getLatestSequence,
  getStats
};
