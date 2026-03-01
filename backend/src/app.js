const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, '../../data/measurements.json');

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'obruk-backend',
        timestamp: new Date().toISOString() 
    });
});

// Root route for reverse-proxy base path checks
app.get('/', (req, res) => {
    res.json({
        success: true,
        service: 'obruk-backend',
        message: 'Pandora backend is running',
        health: '/api/health'
    });
});

// Veri kaydet
app.post('/api/data', async (req, res) => {
    try {
        const { tds, temperature, moisture } = req.body;
        
        if (!tds || !temperature || !moisture) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }

        const measurement = {
            tds: Number(tds),
            temperature: Number(temperature),
            moisture: Number(moisture),
            timestamp: new Date().toISOString()
        };

        let measurements = [];
        if (fs.existsSync(DATA_FILE)) {
            measurements = JSON.parse(fs.readFileSync(DATA_FILE));
        }
        measurements.push(measurement);
        fs.writeFileSync(DATA_FILE, JSON.stringify(measurements, null, 2));

        res.json({ 
            success: true, 
            message: 'Measurement saved',
            measurement 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Son veriyi getir
app.get('/api/data/latest', (req, res) => {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return res.json({ success: true, data: null });
        }
        const measurements = JSON.parse(fs.readFileSync(DATA_FILE));
        const latest = measurements[measurements.length - 1] || null;
        res.json({ success: true, data: latest });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Backend running on port ${PORT}`);
});

module.exports = app;
