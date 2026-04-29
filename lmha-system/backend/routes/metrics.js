const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/requireAuth');
const { aggregateMetrics } = require('../services/metricsAggregator');
const { writeMetrics, readMetrics } = require('../services/googleSheets');
const db = require('../db');

// GET /api/metrics/preview?location=&start=&end=
router.get('/preview', requireAuth, async (req, res, next) => {
  try {
    const { location, start, end } = req.query;
    if (!location || !start || !end) {
      return res.status(400).json({ error: 'location, start, and end are required' });
    }
    if (location !== req.headers['x-location']) {
      return res.status(403).json({ error: 'Location does not match your current session' });
    }

    const metrics = await aggregateMetrics(location, start, end);
    const fbResult = await db.execute({
      sql: 'SELECT * FROM feedback_logs WHERE location = ? AND week_start = ?',
      args: [location, start],
    });
    const feedback = fbResult.rows[0] || { thankyou_letters: 0, verbal_feedback: 0, testimonials: 0, vox_pop: 0 };
    res.json({ ...metrics, feedback });
  } catch (err) {
    console.error('[Metrics] Aggregation error:', err);
    next(err);
  }
});

// POST /api/metrics/submit
router.post('/submit', requireAuth, async (req, res, next) => {
  try {
    const { location, start, end } = req.body;
    if (!location || !start || !end) {
      return res.status(400).json({ error: 'location, start, and end are required' });
    }
    if (location !== req.headers['x-location']) {
      return res.status(403).json({ error: 'Location does not match your current session' });
    }

    const metrics = await aggregateMetrics(location, start, end);
    const fbResult = await db.execute({
      sql: 'SELECT * FROM feedback_logs WHERE location = ? AND week_start = ?',
      args: [location, start],
    });
    const feedback = fbResult.rows[0] || { thankyou_letters: 0, verbal_feedback: 0, testimonials: 0, vox_pop: 0 };
    const result = await writeMetrics(location, { ...metrics, feedback }, start, end);
    res.json({ ok: true, result, metrics: { ...metrics, feedback } });
  } catch (err) {
    console.error('[Metrics] Submit error:', err);
    res.status(500).json({ error: err.message || 'Metrics submission failed' });
  }
});

// GET /api/metrics/read?location=&start=&end=
router.get('/read', requireAuth, async (req, res, next) => {
  try {
    const { location, start, end } = req.query;
    if (!location || !start || !end) {
      return res.status(400).json({ error: 'location, start, and end are required' });
    }
    if (location !== req.headers['x-location']) {
      return res.status(403).json({ error: 'Location does not match your current session' });
    }
    const metrics = await readMetrics(location, start, end);
    res.json(metrics);
  } catch (err) {
    console.error('[Metrics] Read error:', err);
    res.status(500).json({ error: err.message || 'Failed to read metrics from Google Sheets' });
  }
});

// GET /api/metrics/feedback?location=&week_start=
router.get('/feedback', requireAuth, async (req, res, next) => {
  try {
    const { location, week_start } = req.query;
    if (!location || !week_start) {
      return res.status(400).json({ error: 'location and week_start are required' });
    }
    const result = await db.execute({
      sql: 'SELECT * FROM feedback_logs WHERE location = ? AND week_start = ?',
      args: [location, week_start],
    });
    res.json(result.rows[0] || { thankyou_letters: 0, verbal_feedback: 0, testimonials: 0, vox_pop: 0 });
  } catch (err) { next(err); }
});

// POST /api/metrics/feedback
router.post('/feedback', requireAuth, async (req, res, next) => {
  try {
    const { location, week_start, thankyou_letters, verbal_feedback, testimonials, vox_pop } = req.body;
    if (!location || !week_start) {
      return res.status(400).json({ error: 'location and week_start are required' });
    }
    await db.execute({
      sql: `INSERT INTO feedback_logs (location, week_start, thankyou_letters, verbal_feedback, testimonials, vox_pop, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(location, week_start) DO UPDATE SET
              thankyou_letters = excluded.thankyou_letters,
              verbal_feedback  = excluded.verbal_feedback,
              testimonials     = excluded.testimonials,
              vox_pop          = excluded.vox_pop,
              updated_at       = excluded.updated_at`,
      args: [location, week_start, thankyou_letters ?? 0, verbal_feedback ?? 0, testimonials ?? 0, vox_pop ?? 0],
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
