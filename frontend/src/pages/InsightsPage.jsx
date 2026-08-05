import { useCallback, useEffect, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { apiFetch } from '../lib/api'
import { SparkleIcon, ClockIcon } from '../components/Icons'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import AISurface from '../components/ui/AISurface'

const PRIORITY_TABS = [
  { id: '', label: 'All' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
]

function BestTimeCard() {
  const [scope, setScope] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const qp = scope ? `?priority=${scope}` : ''
        const res = await apiFetch(`${apiBase}/insights/best-time${qp}`)
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (!cancelled) setError(json.error || 'Could not load this insight.')
          return
        }
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Network error.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [scope])

  const maxCount = data?.buckets?.length ? Math.max(...data.buckets.map((b) => b.count), 1) : 1

  return (
    <Card className="mb-8">
      <div className="mb-1 flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-accent shrink-0">
          <ClockIcon className="h-3.5 w-3.5" />
        </div>
        <h2 className="text-sm font-semibold text-ink">When you actually get things done</h2>
      </div>
      <p className="ml-9 text-xs text-ink-tertiary">
        Built from real completion timestamps — not a model, just your own history.
      </p>

      <div className="mt-5 flex flex-wrap gap-1.5" role="group" aria-label="Priority scope">
        {PRIORITY_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setScope(t.id)}
            className={`rounded-control border px-3 py-1.5 text-xs font-semibold transition-colors ${
              scope === t.id
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border-strong bg-surface text-ink-tertiary hover:text-ink-secondary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-control border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-5 text-sm text-ink-tertiary">Loading…</p>
      ) : data?.insufficientData ? (
        <p className="mt-5 text-sm text-ink-tertiary">
          Not enough completed tasks yet ({data.sampleSize} so far — need at least 5). Keep
          completing tasks and this fills in on its own.
        </p>
      ) : data ? (
        <>
          {data.recommendation && (
            <p className="mt-5 rounded-control border border-accent-border bg-accent-soft px-4 py-3 text-sm font-medium text-accent">
              {data.recommendation}
            </p>
          )}
          {data.usedFilter === null && scope && (
            <p className="mt-2 text-xs text-ink-tertiary">
              Not enough {scope}-priority completions yet — showing your overall pattern instead.
            </p>
          )}
          <ul className="mt-5 space-y-2">
            {data.buckets.map((b) => (
              <li key={b.id} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs font-medium text-ink-secondary">{b.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-tertiary">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-300"
                    style={{ width: `${(b.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-tertiary">
                  {b.pct}%
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-tertiary">Based on {data.sampleSize} completed tasks.</p>
        </>
      ) : null}
    </Card>
  )
}

const apiBase = import.meta.env.VITE_API_URL ?? ''

// ── Prediction Card ──────────────────────────────────────────────────────────

const RISK_STYLES = {
  high: {
    border: 'border-danger-border',
    bg: 'bg-danger-soft',
    dot: 'bg-danger',
    badge: 'border-danger-border bg-surface text-danger',
    label: 'High Risk',
  },
  medium: {
    border: 'border-warning-border',
    bg: 'bg-warning-soft',
    dot: 'bg-warning',
    badge: 'border-warning-border bg-surface text-warning',
    label: 'Medium Risk',
  },
  low: {
    border: 'border-success-border',
    bg: 'bg-success-soft',
    dot: 'bg-success',
    badge: 'border-success-border bg-surface text-success',
    label: 'On Track',
  },
}

function statColor(v, lowT = 50, midT = 70) {
  if (v < lowT) return 'text-danger'
  if (v < midT) return 'text-warning'
  return 'text-success'
}

function PredictionCard({ data, loading }) {
  if (loading) {
    return (
      <Card className="mb-8 animate-pulse">
        <div className="h-4 w-48 rounded bg-surface-tertiary" />
        <div className="mt-3 h-3 w-72 rounded bg-surface-tertiary" />
      </Card>
    )
  }
  if (!data) return null

  const s = RISK_STYLES[data.riskLevel] ?? RISK_STYLES.medium
  const { meta } = data

  return (
    <div className={`mb-8 rounded-card border ${s.border} ${s.bg} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-tertiary">Prediction</p>
            <h3 className="mt-0.5 text-sm font-semibold text-ink leading-snug">{data.prediction}</h3>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${s.badge}`}>
          {s.label}
        </span>
      </div>

      <p className="mt-3 text-xs text-ink-tertiary leading-relaxed pl-5">{data.reason}</p>

      {meta?.activeSignals?.length > 0 && (
        <div className="mt-4 pl-5 flex flex-wrap gap-1.5">
          {meta.activeSignals.map((sig, i) => (
            <span key={i} className="inline-flex items-center rounded-control border border-border bg-surface px-2.5 py-1 text-[10px] text-ink-tertiary leading-none">
              {sig}
            </span>
          ))}
        </div>
      )}

      {meta && (
        <div className="mt-4 pl-5 flex flex-wrap gap-6 border-t border-border/60 pt-3">
          {meta.taskCompletionRate3d !== null && (
            <div>
              <p className="text-[9px] uppercase tracking-wide text-ink-tertiary">3d tasks</p>
              <p className={`text-sm font-bold tabular-nums ${statColor(meta.taskCompletionRate3d)}`}>{meta.taskCompletionRate3d}%</p>
            </div>
          )}
          {meta.taskCompletionRate7d !== null && (
            <div>
              <p className="text-[9px] uppercase tracking-wide text-ink-tertiary">7d tasks</p>
              <p className={`text-sm font-bold tabular-nums ${statColor(meta.taskCompletionRate7d)}`}>{meta.taskCompletionRate7d}%</p>
            </div>
          )}
          {meta.habitConsistencyLateWeek !== null && (
            <div>
              <p className="text-[9px] uppercase tracking-wide text-ink-tertiary">Habit rate</p>
              <p className={`text-sm font-bold tabular-nums ${statColor(meta.habitConsistencyLateWeek)}`}>{meta.habitConsistencyLateWeek}%</p>
            </div>
          )}
          {meta.riskScore !== undefined && (
            <div className="ml-auto">
              <p className="text-[9px] uppercase tracking-wide text-ink-tertiary">Risk score</p>
              <p className="text-sm font-bold tabular-nums text-ink-secondary">{meta.riskScore}/100</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const CHART_GRID = '#E4E4E7'
const CHART_AXIS = '#A1A1AA'
const CHART_TOOLTIP = { background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: 8, fontSize: 12 }

export default function InsightsPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [prediction, setPrediction] = useState(null)
  const [predictionLoading, setPredictionLoading] = useState(true)

  const [weekly, setWeekly] = useState(null)
  const [weeklyLoading, setWeeklyLoading] = useState(false)
  const [weeklyError, setWeeklyError] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [analyticsError, setAnalyticsError] = useState(null)

  const loadWeeklyReport = useCallback(async () => {
    setWeeklyError(null)
    setWeeklyLoading(true)
    try {
      const res = await apiFetch(`${apiBase}/ai/weekly-report`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setWeeklyError(json.detail || json.error || 'Could not load weekly report.')
        setWeekly(null)
        return
      }
      setWeekly(json)
    } catch (e) {
      setWeeklyError(e instanceof Error ? e.message : 'Network error.')
      setWeekly(null)
    } finally {
      setWeeklyLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setError(null)
      try {
        const res = await apiFetch(`${apiBase}/insights`)
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (!cancelled) setError(json.error || 'Could not load insights.')
          return
        }
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Network error.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch(`${apiBase}/insights/predictions`)
        if (!res.ok || cancelled) return
        const json = await res.json().catch(() => null)
        if (!cancelled) setPrediction(json)
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setPredictionLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setAnalyticsError(null)
      try {
        const res = await apiFetch(`${apiBase}/analytics/summary`)
        const json = await res.json().catch(() => ({}))
        if (!cancelled) {
          if (!res.ok) {
            setAnalyticsError(json.error || 'Could not load analytics summary.')
            setAnalytics(null)
          } else {
            setAnalytics(json)
          }
        }
      } catch (e) {
        if (!cancelled) {
          setAnalyticsError(e instanceof Error ? e.message : 'Network error.')
          setAnalytics(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const pct = data?.consistencyPercent
  const ringOffset = pct == null ? 283 : 283 * (1 - pct / 100)

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-tertiary">
          Pattern detection
        </p>
        <h1 className="mt-1.5 text-display text-ink">Insights</h1>
        <p className="mt-2 text-sm text-ink-tertiary">
          Built from habit logs (dates only — no clock time). Window: last{' '}
          <span className="font-medium text-ink-secondary">{data?.windowDays ?? '…'}</span> days
          {data?.asOfDate ? (
            <>
              {' '}
              · as of <span className="font-mono text-ink-tertiary">{data.asOfDate}</span>
            </>
          ) : null}
          .
        </p>
      </header>

      {/* Prediction Card */}
      <PredictionCard data={prediction} loading={predictionLoading} />

      <BestTimeCard />

      <AISurface className="mb-8" padding="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ai text-white shrink-0">
              <SparkleIcon className="h-3.5 w-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink">Weekly report (AI)</h2>
              <p className="text-xs text-ink-tertiary">
                Last 7 days of tasks + habit logs, summarized by Gemini.
              </p>
            </div>
          </div>
          <Button variant="ai" size="sm" disabled={weeklyLoading} onClick={() => void loadWeeklyReport()} className="shrink-0">
            {weeklyLoading ? 'Generating…' : weekly ? 'Regenerate' : 'Generate weekly report'}
          </Button>
        </div>

        {weeklyError && (
          <p className="mt-4 rounded-control border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
            {weeklyError}
          </p>
        )}

        {weekly?.report && (
          <div className="mt-6 space-y-5 border-t border-ai-border/50 pt-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-success">
                What went well
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{weekly.report.whatWentWell}</p>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-danger">
                What failed
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{weekly.report.whatFailed}</p>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-warning">
                3 improvements
              </h3>
              <ul className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-secondary">
                {(weekly.report.improvements || []).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
            {weekly.weekDays && (
              <p className="text-[10px] text-ink-tertiary">
                Window: {weekly.weekDays[0]} → {weekly.weekDays[weekly.weekDays.length - 1]}
              </p>
            )}
          </div>
        )}
      </AISurface>

      <Card className="mb-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">
            Analytics summary
          </h2>
          {analytics && (
            <p className="text-xs text-ink-tertiary">
              Tasks: <span className="text-ink-secondary">{analytics.totalTasks}</span> · Completed:{' '}
              <span className="text-success">{analytics.completedPercent}%</span> · Avg streak:{' '}
              <span className="text-warning">{analytics.streakAvg}</span>
            </p>
          )}
        </div>
        {analyticsError && (
          <p className="mb-4 rounded-control border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger">
            {analyticsError}
          </p>
        )}
        {analytics && (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-control border border-border bg-surface-secondary/40 p-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-tertiary">
                Completion rate graph
              </h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.completionRateGraph || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis dataKey="day" stroke={CHART_AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: CHART_GRID }} />
                    <YAxis domain={[0, 100]} stroke={CHART_AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: CHART_GRID }} />
                    <Tooltip contentStyle={CHART_TOOLTIP} labelStyle={{ color: '#18181B' }} />
                    <Line type="monotone" dataKey="rate" stroke="#4F46E5" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-control border border-border bg-surface-secondary/40 p-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-tertiary">
                Streak trend
              </h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.streakTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis dataKey="day" stroke={CHART_AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: CHART_GRID }} />
                    <YAxis domain={[0, 100]} stroke={CHART_AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: CHART_GRID }} />
                    <Tooltip contentStyle={CHART_TOOLTIP} labelStyle={{ color: '#18181B' }} />
                    <Line type="monotone" dataKey="value" stroke="#D97706" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </Card>

      {loading && <p className="text-sm text-ink-tertiary">Analyzing habits…</p>}

      {error && (
        <div className="rounded-control border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </div>
      )}

      {data && !loading && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <h2 className="text-xs font-bold uppercase tracking-wide text-ink-tertiary">
                Weakest habit
              </h2>
              {data.weakestHabit ? (
                <>
                  <p className="mt-3 text-xl font-semibold text-ink">{data.weakestHabit.name}</p>
                  <p className="mt-2 text-sm text-ink-tertiary">
                    <span className="text-danger">{data.weakestHabit.missRate}%</span> of
                    logged days are misses ·{' '}
                    <span className="text-success">
                      {data.weakestHabit.consistencyPercent}%
                    </span>{' '}
                    done
                  </p>
                  <p className="mt-1 text-xs text-ink-tertiary">
                    Based on {data.weakestHabit.totalCheckIns} check-ins (≥2 required).
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-ink-tertiary">
                  Not enough overlapping logs to rank a weakest habit yet.
                </p>
              )}
            </Card>

            <Card>
              <h2 className="text-xs font-bold uppercase tracking-wide text-ink-tertiary">
                Consistency
              </h2>
              <div className="mt-4 flex items-center gap-5">
                <div className="relative h-24 w-24 shrink-0">
                  <svg className="-rotate-90" width="96" height="96" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="45" fill="none" stroke="currentColor" strokeWidth="7" className="text-surface-tertiary" />
                    {pct != null && (
                      <circle
                        cx="48"
                        cy="48"
                        r="45"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray="283"
                        strokeDashoffset={ringOffset}
                        className="text-accent transition-[stroke-dashoffset] duration-700 ease-out"
                      />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold tabular-nums text-ink">
                      {pct == null ? '—' : `${pct}%`}
                    </span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-ink-tertiary">
                  Share of logged days marked <span className="text-success">done</span>{' '}
                  vs <span className="text-danger">missed</span> across all habits in the
                  window.
                </p>
              </div>
            </Card>
          </div>

          {data.mostMissedHabit && (
            <div className="rounded-card border border-danger-border bg-danger-soft px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-wide text-danger/80">
                Most missed (count)
              </p>
              <p className="mt-1 text-sm text-ink">
                <span className="font-semibold">{data.mostMissedHabit.name}</span> —{' '}
                {data.mostMissedHabit.missCount} miss
                {data.mostMissedHabit.missCount === 1 ? '' : 'es'} logged in the window.
              </p>
            </div>
          )}

          <Card>
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border pb-4">
              <h2 className="text-sm font-semibold text-ink">Insights</h2>
              <p className="text-xs text-ink-tertiary">
                Streak breaks:{' '}
                <span className="font-mono text-ink-secondary">{data.streakBreaks}</span>
              </p>
            </div>
            <ul className="mt-5 space-y-3">
              {(data.insights || []).map((line, i) => (
                <li
                  key={i}
                  className="flex gap-3 rounded-control border border-border bg-surface-secondary/40 px-4 py-3 text-sm leading-relaxed text-ink-secondary"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-xs font-bold text-accent" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="min-w-0">{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs text-ink-tertiary">
              Example phrasing like "after 9PM" needs timestamps in logs; today we only detect{' '}
              <strong className="font-medium text-ink-secondary">weekday</strong> patterns from
              dates.
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}
