import express from 'express';
import { db } from '../db/index.js';
import { queueService } from '../jobs/queue.js';

const router = express.Router();

// Get Email Logs for live Inbox Drawer UI
router.get('/email-logs', async (req, res) => {
  try {
    const logs = await db.query(`SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 50`);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Redis Background Queue Status Metrics
router.get('/redis-metrics', async (req, res) => {
  try {
    const metrics = await queueService.getMetrics();
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Gemini API Key dynamically
router.post('/settings/gemini-key', async (req, res) => {
  try {
    const { apiKey } = req.body;
    process.env.GEMINI_API_KEY = apiKey;
    res.json({ success: true, message: 'Gemini API Key updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
