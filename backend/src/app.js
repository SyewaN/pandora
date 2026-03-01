const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5000';
const DATA_FILE = process.env.DATA_FILE_PATH || path.join(__dirname, '../../data/measurements.json');
const DB_FILE = process.env.DATA_DB_PATH || path.join(__dirname, '../../data/measurements.db');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]');
}

let db;
async function initDb() {
  db = await open({ filename: DB_FILE, driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS measurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tds REAL NOT NULL,
      temperature REAL NOT NULL,
      moisture REAL NOT NULL,
      timestamp TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_measurements_timestamp ON measurements(timestamp DESC);
  `);
}

function validateMeasurement(input) {
  const tds = Number(input.tds);
  const temperature = Number(input.temperature);
  const moisture = Number(input.moisture);
  if (!Number.isFinite(tds) || !Number.isFinite(temperature) || !Number.isFinite(moisture)) {
    return null;
  }
  return {
    tds,
    temperature,
    moisture,
    timestamp: input.timestamp || new Date().toISOString(),
  };
}

async function insertMeasurement(measurement) {
  await db.run(
    `INSERT INTO measurements (tds, temperature, moisture, timestamp) VALUES (?, ?, ?, ?)`,
    [measurement.tds, measurement.temperature, measurement.moisture, measurement.timestamp]
  );
}

function appendMeasurementToJson(measurement) {
  let measurements = [];
  try {
    measurements = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!Array.isArray(measurements)) measurements = [];
  } catch (_err) {
    measurements = [];
  }
  measurements.push(measurement);
  fs.writeFileSync(DATA_FILE, JSON.stringify(measurements, null, 2));
}

function parseCsvRows(buffer) {
  const text = buffer.toString('utf8').trim();
  if (!text) return [];
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];

  const header = lines[0].toLowerCase().split(',').map((s) => s.trim());
  const hasHeader = header.includes('tds') && header.includes('temperature') && header.includes('moisture');
  const startIndex = hasHeader ? 1 : 0;

  const mapIndex = {
    tds: hasHeader ? header.indexOf('tds') : 0,
    temperature: hasHeader ? header.indexOf('temperature') : 1,
    moisture: hasHeader ? header.indexOf('moisture') : 2,
    timestamp: hasHeader ? header.indexOf('timestamp') : 3,
  };

  const rows = [];
  for (let i = startIndex; i < lines.length; i += 1) {
    const cols = lines[i].split(',').map((s) => s.trim());
    rows.push({
      tds: cols[mapIndex.tds],
      temperature: cols[mapIndex.temperature],
      moisture: cols[mapIndex.moisture],
      timestamp: mapIndex.timestamp >= 0 ? cols[mapIndex.timestamp] : undefined,
    });
  }
  return rows;
}

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/dashboard', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/api/health', async (_req, res) => {
  try {
    await db.get('SELECT 1 as ok');
    res.json({
      status: 'healthy',
      service: 'obruk-backend',
      db: 'ok',
      ai_service_url: AI_SERVICE_URL,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

app.post('/api/data', async (req, res) => {
  try {
    const measurement = validateMeasurement(req.body || {});
    if (!measurement) {
      return res.status(400).json({ success: false, error: 'Invalid or missing fields: tds, temperature, moisture' });
    }
    await insertMeasurement(measurement);
    appendMeasurementToJson(measurement);
    return res.json({ success: true, message: 'Measurement saved', measurement });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/data/latest', async (_req, res) => {
  try {
    const latest = await db.get(
      `SELECT tds, temperature, moisture, timestamp FROM measurements ORDER BY datetime(timestamp) DESC LIMIT 1`
    );
    return res.json({ success: true, data: latest || null });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/data', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 50)));
    const offset = Math.max(0, Number(req.query.offset || 0));
    const rows = await db.all(
      `SELECT id, tds, temperature, moisture, timestamp FROM measurements ORDER BY datetime(timestamp) DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const total = await db.get('SELECT COUNT(*) as count FROM measurements');
    res.json({ success: true, data: rows, total: total.count, limit, offset });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/data/mock', async (req, res) => {
  try {
    const count = Math.max(1, Math.min(200, Number(req.body?.count || 20)));
    const now = Date.now();
    const created = [];
    for (let i = 0; i < count; i += 1) {
      const measurement = {
        tds: Number((450 + Math.random() * 60 - 30).toFixed(2)),
        temperature: Number((24 + Math.random() * 4 - 2).toFixed(2)),
        moisture: Number((360 + Math.random() * 50 - 25).toFixed(2)),
        timestamp: new Date(now - (count - i) * 60000).toISOString(),
      };
      await insertMeasurement(measurement); // eslint-disable-line no-await-in-loop
      appendMeasurementToJson(measurement);
      created.push(measurement);
    }
    res.json({ success: true, message: `${count} mock measurements generated`, data: created });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/data/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Missing file field. Use multipart form field name "file".' });
    }

    let rows = [];
    const name = req.file.originalname.toLowerCase();
    if (name.endsWith('.json')) {
      const parsed = JSON.parse(req.file.buffer.toString('utf8'));
      if (!Array.isArray(parsed)) {
        return res.status(400).json({ success: false, error: 'JSON upload must be an array of measurements.' });
      }
      rows = parsed;
    } else if (name.endsWith('.csv')) {
      rows = parseCsvRows(req.file.buffer);
    } else {
      return res.status(400).json({ success: false, error: 'Supported file types: .json, .csv' });
    }

    const valid = rows.map(validateMeasurement).filter(Boolean);
    if (valid.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid rows found in uploaded file.' });
    }

    for (const measurement of valid) {
      // eslint-disable-next-line no-await-in-loop
      await insertMeasurement(measurement);
      appendMeasurementToJson(measurement);
    }
    return res.json({ success: true, message: 'File processed', inserted: valid.length });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/ai/health', async (_req, res) => {
  try {
    const { data } = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 5000 });
    res.json({ success: true, data });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message });
  }
});

app.post('/api/ai/predict', async (req, res) => {
  try {
    const { data } = await axios.post(`${AI_SERVICE_URL}/predict`, req.body || {}, { timeout: 15000 });
    res.json(data);
  } catch (error) {
    res.status(502).json({ success: false, error: error.message });
  }
});

app.post('/api/ai/train/start', async (req, res) => {
  try {
    const { data } = await axios.post(`${AI_SERVICE_URL}/train/start`, req.body || {}, { timeout: 15000 });
    res.json(data);
  } catch (error) {
    res.status(502).json({ success: false, error: error.message });
  }
});

app.get('/api/ai/train/status', async (_req, res) => {
  try {
    const { data } = await axios.get(`${AI_SERVICE_URL}/train/status`, { timeout: 5000 });
    res.json(data);
  } catch (error) {
    res.status(502).json({ success: false, error: error.message });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      // eslint-disable-next-line no-console
      console.log(`Backend running on port ${PORT}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });

module.exports = app;
