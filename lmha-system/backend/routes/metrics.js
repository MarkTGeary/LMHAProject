const express = require('express');
const router = express.Router();
const { aggregateMetrics } = require('../services/metricsAggregator');
const { writeMetrics, readMetrics } = require('../services/googleSheets');
const db = require('../db');
const { ApiError, badRequest } = require('../lib/errors');
const { assertRequestLocation, countInt, parseDateString } = require('../lib/validation');

function parseDateRange(input) {
  const start = parseDateString(input.start, 'start');
  const end = parseDateString(input.end, 'end');
  if (start > end) throw badRequest('start must be before or equal to end');
  return { start, end };
}

// GET /api/metrics/preview?location=&start=&end=
router.get('/preview', async (req, res, next) => {
  try {
    const location = assertRequestLocation(req, req.query.location);
    const { start, end } = parseDateRange(req.query);

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
router.post('/submit', async (req, res, next) => {
  try {
    const location = assertRequestLocation(req, req.body.location);
    const { start, end } = parseDateRange(req.body);

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
    next(err instanceof ApiError ? err : new ApiError(502, 'Metrics submission failed'));
  }
});

// GET /api/metrics/read?location=&start=&end=
router.get('/read', async (req, res, next) => {
  try {
    const location = assertRequestLocation(req, req.query.location);
    const { start, end } = parseDateRange(req.query);
    const metrics = await readMetrics(location, start, end);
    res.json(metrics);
  } catch (err) {
    console.error('[Metrics] Read error:', err);
    next(err instanceof ApiError ? err : new ApiError(502, 'Failed to read metrics from Google Sheets'));
  }
});

// GET /api/metrics/feedback?location=&week_start=
router.get('/feedback', async (req, res, next) => {
  try {
    const location = assertRequestLocation(req, req.query.location);
    const week_start = parseDateString(req.query.week_start, 'week_start');
    const result = await db.execute({
      sql: 'SELECT * FROM feedback_logs WHERE location = ? AND week_start = ?',
      args: [location, week_start],
    });
    res.json(result.rows[0] || { thankyou_letters: 0, verbal_feedback: 0, testimonials: 0, vox_pop: 0 });
  } catch (err) { next(err); }
});

// POST /api/metrics/feedback
router.post('/feedback', async (req, res, next) => {
  try {
    const location = assertRequestLocation(req, req.body.location);
    const week_start = parseDateString(req.body.week_start, 'week_start');
    const thankyou_letters = countInt(req.body.thankyou_letters, 'thankyou_letters');
    const verbal_feedback = countInt(req.body.verbal_feedback, 'verbal_feedback');
    const testimonials = countInt(req.body.testimonials, 'testimonials');
    const vox_pop = countInt(req.body.vox_pop, 'vox_pop');
    await db.execute({
      sql: `INSERT INTO feedback_logs (location, week_start, thankyou_letters, verbal_feedback, testimonials, vox_pop, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(location, week_start) DO UPDATE SET
              thankyou_letters = excluded.thankyou_letters,
              verbal_feedback  = excluded.verbal_feedback,
              testimonials     = excluded.testimonials,
              vox_pop          = excluded.vox_pop,
              updated_at       = excluded.updated_at`,
      args: [location, week_start, thankyou_letters, verbal_feedback, testimonials, vox_pop],
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
