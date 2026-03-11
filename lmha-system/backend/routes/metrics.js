const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/requireAuth');
const { aggregateMetrics } = require('../services/metricsAggregator');
const { writeMetrics } = require('../services/googleSheets');

// GET /api/metrics/preview?location=&start=&end=
router.get('/preview', requireAuth, (req, res) => {
  const { location, start, end } = req.query;
  if (!location || !start || !end) {
    return res.status(400).json({ error: 'location, start, and end are required' });
  }

  try {
    const metrics = aggregateMetrics(location, start, end);
    res.json(metrics);
  } catch (err) {
    console.error('[Metrics] Aggregation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/metrics/submit
router.post('/submit', requireAuth, async (req, res) => {
  const { location, start, end } = req.body;
  if (!location || !start || !end) {
    return res.status(400).json({ error: 'location, start, and end are required' });
  }

  try {
    const metrics = aggregateMetrics(location, start, end);
    const result = await writeMetrics(location, metrics, start, end);
    res.json({ ok: true, result, metrics });
  } catch (err) {
    console.error('[Metrics] Submit error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
