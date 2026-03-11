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
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitResult, setSubmitResult] = useState(null)

  const preview = async () => {
    setError(''); setMetrics(null); setSubmitResult(null); setLoading(true)
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

        <button onClick={preview} disabled={loading} className="btn-primary btn-lg w-full">
          {loading ? 'Loading...' : 'Preview Metrics'}
        </button>

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
                <h2 className="text-xl font-bold">
                  Metrics Preview — {location}
                </h2>
                <span className="text-sm text-gray-500">{start} → {end}</span>
              </div>
              <MetricsPreview metrics={metrics} />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="btn-secondary btn-lg flex-1 no-print"
              >
                🖨️ Print Report
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="btn-success btn-lg flex-1"
              >
                {submitting ? 'Pushing...' : '📊 Push to Google Sheets'}
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-sm no-print">
              <strong>Note:</strong> This will write to the {location} spreadsheet. Existing cells are never deleted. Make sure the correct week column exists in the spreadsheet.
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
