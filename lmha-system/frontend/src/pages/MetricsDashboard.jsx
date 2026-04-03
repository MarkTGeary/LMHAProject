import { useState } from 'react'
import { useAuth } from '../App'
import Layout from '../components/Layout'
import MetricsPreview from '../components/MetricsPreview'

function getMondayOfWeek(d = new Date()) {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

export default function MetricsDashboard() {
  const { location } = useAuth()

  const thisMon = getMondayOfWeek(new Date())
  const thisSun = new Date(thisMon)
  thisSun.setDate(thisMon.getDate() + 6)

  const [start, setStart] = useState(thisMon.toISOString().slice(0, 10))
  const [end, setEnd] = useState(thisSun.toISOString().slice(0, 10))
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingSheets, setLoadingSheets] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitResult, setSubmitResult] = useState(null)
  const [feedback, setFeedback] = useState({ thankyou_letters: 0, verbal_feedback: 0, testimonials: 0, vox_pop: 0 })
  const [feedbackSaving, setFeedbackSaving] = useState(false)
  const [feedbackSaved, setFeedbackSaved] = useState(false)

  const loadFeedback = async (weekStart) => {
    try {
      const res = await fetch(
        `/api/metrics/feedback?location=${encodeURIComponent(location)}&week_start=${weekStart}`,
        { credentials: 'include' }
      )
      if (res.ok) {
        const data = await res.json()
        setFeedback({ thankyou_letters: data.thankyou_letters ?? 0, verbal_feedback: data.verbal_feedback ?? 0, testimonials: data.testimonials ?? 0, vox_pop: data.vox_pop ?? 0 })
      }
    } catch { /* non-critical */ }
  }

  const saveFeedback = async () => {
    setFeedbackSaving(true); setFeedbackSaved(false)
    try {
      await fetch('/api/metrics/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ location, week_start: start, ...feedback }),
      })
      setFeedbackSaved(true)
      setTimeout(() => setFeedbackSaved(false), 2500)
    } catch { /* non-critical */ }
    setFeedbackSaving(false)
  }

  const loadFromSheets = async () => {
    setError(''); setMetrics(null); setSubmitResult(null); setLoadingSheets(true)
    try {
      const res = await fetch(
        `/api/metrics/read?location=${encodeURIComponent(location)}&start=${start}&end=${end}`,
        { credentials: 'include' }
      )
      const data = await res.json()
      if (!res.ok) { setError(data.error); setLoadingSheets(false); return }
      setMetrics(data)
      // Populate feedback inputs from what was in the sheet
      if (data.feedback) setFeedback(data.feedback)
    } catch {
      setError('Failed to read from Google Sheets')
    }
    setLoadingSheets(false)
  }

  const preview = async () => {
    setError(''); setMetrics(null); setSubmitResult(null); setLoading(true)
    await loadFeedback(start)
    try {
      const res = await fetch(
        `/api/metrics/preview?location=${encodeURIComponent(location)}&start=${start}&end=${end}`,
        { credentials: 'include' }
      )
      const data = await res.json()
      if (!res.ok) { setError(data.error); setLoading(false); return }
      setMetrics(data)
    } catch {
      setError('Failed to load metrics')
    }
    setLoading(false)
  }

  const submit = async () => {
    if (!metrics) return
    if (!confirm(`Push metrics for ${location} (${start} to ${end}) to Google Sheets? This cannot be undone.`)) return
    setError(''); setSubmitting(true); setSubmitResult(null)
    try {
      const res = await fetch('/api/metrics/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ location, start, end }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setSubmitting(false); return }
      setSubmitResult(data.result)
    } catch {
      setError('Failed to submit metrics')
    }
    setSubmitting(false)
  }

  const setThisWeek = () => {
    const mon = getMondayOfWeek(new Date())
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    setStart(mon.toISOString().slice(0, 10))
    setEnd(sun.toISOString().slice(0, 10))
  }

  const setLastWeek = () => {
    const mon = getMondayOfWeek(new Date())
    mon.setDate(mon.getDate() - 7)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    setStart(mon.toISOString().slice(0, 10))
    setEnd(sun.toISOString().slice(0, 10))
  }

  return (
    <Layout title="Submit Metrics">
      <div className="space-y-5 pb-10">
        {/* Date range selector */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Date Range</h2>
          <div className="flex gap-2 mb-4">
            <button onClick={setThisWeek} className="btn-secondary btn-sm">This week</button>
            <button onClick={setLastWeek} className="btn-secondary btn-sm">Last week</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="field mb-0">
              <label className="label">From</label>
              <input type="date" className="input" value={start} onChange={e => setStart(e.target.value)} />
            </div>
            <div className="field mb-0">
              <label className="label">To</label>
              <input type="date" className="input" value={end} onChange={e => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 p-3 bg-gray-50 rounded-xl text-sm text-gray-600">
            Location: <strong>{location}</strong>
          </div>
        </div>

        {/* Miscellaneous feedback — manually entered by staff */}
        <div className="card">
          <h2 className="text-xl font-bold mb-1">Miscellaneous — Feedback from Service Users</h2>
          <p className="text-sm text-gray-500 mb-4">Enter counts for the current week. These are saved separately and included when pushing to Sheets.</p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'thankyou_letters', label: 'Thank you letter / Card / Email' },
              { key: 'verbal_feedback',  label: 'Verbal Feedback' },
              { key: 'testimonials',     label: 'Testimonials' },
              { key: 'vox_pop',          label: 'Vox Pop (on street)' },
            ].map(({ key, label }) => (
              <div key={key} className="field mb-0">
                <label className="label">{label}</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  value={feedback[key]}
                  onChange={e => setFeedback(f => ({ ...f, [key]: parseInt(e.target.value) || 0 }))}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={saveFeedback} disabled={feedbackSaving} className="btn-secondary btn-sm">
              {feedbackSaving ? 'Saving…' : 'Save Feedback Counts'}
            </button>
            {feedbackSaved && <span className="text-green-600 text-sm font-medium">✓ Saved</span>}
            <span className="ml-auto text-sm text-gray-500 font-semibold">
              Total: {Object.values(feedback).reduce((a, b) => a + (b || 0), 0)}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={preview} disabled={loading || loadingSheets} className="btn-primary btn-lg flex-1">
            {loading ? 'Loading...' : 'Preview Metrics'}
          </button>
          <button onClick={loadFromSheets} disabled={loading || loadingSheets} className="btn-secondary btn-lg flex-1">
            {loadingSheets ? 'Reading...' : '📋 Load from Sheets'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 text-red-700 font-semibold">
            {error}
          </div>
        )}

        {submitResult && (
          <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 text-green-700">
            <div className="font-bold">✓ Successfully pushed to Google Sheets</div>
            <div className="text-sm mt-1">{submitResult.updatedCells} cells updated in column {submitResult.column}</div>
          </div>
        )}

        {metrics && (
          <>
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">Metrics Preview — {location}</h2>
                  {metrics?._source === 'sheets'
                    ? <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        Read from Google Sheets · column {metrics._column}
                      </span>
                    : <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                        Calculated from local database
                      </span>
                  }
                </div>
                <span className="text-sm text-gray-500">{start} → {end}</span>
              </div>
              <MetricsPreview metrics={{ ...metrics, feedback }} />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="btn-secondary btn-lg flex-1 no-print"
              >
                🖨️ Print Report
              </button>
              {metrics?._source !== 'sheets' && (
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="btn-success btn-lg flex-1"
                >
                  {submitting ? 'Pushing...' : '📊 Push to Google Sheets'}
                </button>
              )}
            </div>

            {metrics?._source !== 'sheets' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-sm no-print">
                <strong>Note:</strong> This will write to the {location} spreadsheet. Existing cells are never deleted. Make sure the correct week column exists in the spreadsheet.
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
