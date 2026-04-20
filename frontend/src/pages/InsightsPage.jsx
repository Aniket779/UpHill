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

const apiBase = import.meta.env.VITE_API_URL ?? ''

// ── Prediction Card ──────────────────────────────────────────────────────────

const RISK_STYLES = {
  high: {
    border: 'border-rose-500/40',
    bg: 'bg-gradient-to-r from-rose-950/60 via-rose-950/30 to-slate-900/40',
    dot: 'bg-rose-500',
    badge: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
    label: 'High Risk',
    glow: 'shadow-rose-900/30',
  },
  medium: {
    border: 'border-amber-500/40',
    bg: 'bg-gradient-to-r from-amber-950/50 via-amber-950/20 to-slate-900/40',
    dot: 'bg-amber-400',
    badge: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
    label: 'Medium Risk',
    glow: 'shadow-amber-900/30',
  },
  low: {
    border: 'border-emerald-500/35',
    bg: 'bg-gradient-to-r from-emerald-950/40 via-emerald-950/15 to-slate-900/40',
    dot: 'bg-emerald-400',
    badge: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
    label: 'On Track',
    glow: 'shadow-emerald-900/20',
  },
}

function PredictionCard({ data, loading }) {
  if (loading) {
    return (
      <div className="mb-10 rounded-2xl border border-white/5 bg-slate-900/40 p-5 animate-pulse">
        <div className="h-4 w-48 rounded bg-slate-800" />
        <div className="mt-3 h-3 w-72 rounded bg-slate-800" />
      </div>
    )
  }
  if (!data) return null

  const s = RISK_STYLES[data.riskLevel] ?? RISK_STYLES.medium
  const { meta } = data

  return (
    <div className={`mb-10 rounded-2xl border ${s.border} ${s.bg} p-5 shadow-xl ${s.glow} backdrop-blur-sm`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3 shrink-0 mt-0.5">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${s.dot} opacity-60`} />
            <span className={`relative inline-flex h-3 w-3 rounded-full ${s.dot}`} />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Prediction</p>
            <h3 className="mt-0.5 text-sm font-semibold text-white leading-snug">{data.prediction}</h3>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${s.badge}`}>
          {s.label}
        </span>
      </div>

      {/* Reason */}
      <p className="mt-3 text-xs text-slate-400 leading-relaxed pl-6">{data.reason}</p>

      {/* Active signal tags */}
      {meta?.activeSignals?.length > 0 && (
        <div className="mt-4 pl-6 flex flex-wrap gap-1.5">
          {meta.activeSignals.map((sig, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-lg border border-white/5 bg-slate-900/60 px-2.5 py-1 text-[10px] text-slate-400 leading-none"
            >
              {sig}
            </span>
          ))}
        </div>
      )}

      {/* Mini stats footer */}
      {meta && (
        <div className="mt-4 pl-6 flex flex-wrap gap-6 border-t border-white/5 pt-3">
          {meta.taskCompletionRate3d !== null && (
            <div>
              <p className="text-[9px] uppercase tracking-wider text-slate-600">3d tasks</p>
              <p className={`text-sm font-bold tabular-nums ${
                meta.taskCompletionRate3d < 50 ? 'text-rose-400'
                : meta.taskCompletionRate3d < 70 ? 'text-amber-400' : 'text-emerald-400'
              }`}>{meta.taskCompletionRate3d}%</p>
            </div>
          )}
          {meta.taskCompletionRate7d !== null && (
            <div>
              <p className="text-[9px] uppercase tracking-wider text-slate-600">7d tasks</p>
              <p className={`text-sm font-bold tabular-nums ${
                meta.taskCompletionRate7d < 50 ? 'text-rose-400'
                : meta.taskCompletionRate7d < 70 ? 'text-amber-400' : 'text-emerald-400'
              }`}>{meta.taskCompletionRate7d}%</p>
            </div>
          )}
          {meta.habitConsistencyLateWeek !== null && (
            <div>
              <p className="text-[9px] uppercase tracking-wider text-slate-600">Habit rate</p>
              <p className={`text-sm font-bold tabular-nums ${
                meta.habitConsistencyLateWeek < 50 ? 'text-rose-400'
                : meta.habitConsistencyLateWeek < 70 ? 'text-amber-400' : 'text-emerald-400'
              }`}>{meta.habitConsistencyLateWeek}%</p>
            </div>
          )}
          {meta.riskScore !== undefined && (
            <div className="ml-auto">
              <p className="text-[9px] uppercase tracking-wider text-slate-600">Risk score</p>
              <p className="text-sm font-bold tabular-nums text-slate-300">{meta.riskScore}/100</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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
    <div className="px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/90">
            Pattern detection
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Insights
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Built from habit logs (dates only — no clock time). Window: last{' '}
            <span className="font-medium text-slate-300">{data?.windowDays ?? '…'}</span> days
            {data?.asOfDate ? (
              <>
                {' '}
                · as of <span className="font-mono text-slate-400">{data.asOfDate}</span>
              </>
            ) : null}
            .
          </p>
        </header>

        {/* Prediction Card */}
        <PredictionCard data={prediction} loading={predictionLoading} />

        <section className="mb-10 rounded-2xl border border-violet-900/35 bg-gradient-to-br from-violet-950/40 via-slate-900/50 to-slate-950/80 p-6 shadow-xl shadow-black/25">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-violet-200/90">
                Weekly report (AI)
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Last 7 days of tasks + habit logs, summarized by Gemini.
              </p>
            </div>
            <button
              type="button"
              disabled={weeklyLoading}
              onClick={() => void loadWeeklyReport()}
              className="shrink-0 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {weeklyLoading ? 'Generating…' : weekly ? 'Regenerate' : 'Generate weekly report'}
            </button>
          </div>

          {weeklyError && (
            <p className="mt-4 rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200" role="alert">
              {weeklyError}
            </p>
          )}

          {weekly?.report && (
            <div className="mt-6 space-y-5 border-t border-slate-800/80 pt-6">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400/90">
                  What went well
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">{weekly.report.whatWentWell}</p>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400/90">
                  What failed
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">{weekly.report.whatFailed}</p>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300/90">
                  3 improvements
                </h3>
                <ul className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-200">
                  {(weekly.report.improvements || []).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
              {weekly.weekDays && (
                <p className="text-[10px] text-slate-600">
                  Window: {weekly.weekDays[0]} → {weekly.weekDays[weekly.weekDays.length - 1]}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="mb-10 rounded-2xl border border-cyan-900/35 bg-slate-900/45 p-6 shadow-xl shadow-black/20">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-200/90">
              Analytics summary
            </h2>
            {analytics && (
              <p className="text-xs text-slate-500">
                Tasks: <span className="text-slate-300">{analytics.totalTasks}</span> · Completed:{' '}
                <span className="text-emerald-300">{analytics.completedPercent}%</span> · Avg streak:{' '}
                <span className="text-orange-300">{analytics.streakAvg}</span>
              </p>
            )}
          </div>
          {analyticsError && (
            <p className="mb-4 rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {analyticsError}
            </p>
          )}
          {analytics && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Completion rate graph
                </h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.completionRateGraph || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="day" stroke="#64748b" />
                      <YAxis domain={[0, 100]} stroke="#64748b" />
                      <Tooltip
                        contentStyle={{ background: '#020617', border: '1px solid #334155' }}
                        labelStyle={{ color: '#cbd5e1' }}
                      />
                      <Line type="monotone" dataKey="rate" stroke="#22d3ee" strokeWidth={2.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Streak trend
                </h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.streakTrend || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="day" stroke="#64748b" />
                      <YAxis domain={[0, 100]} stroke="#64748b" />
                      <Tooltip
                        contentStyle={{ background: '#020617', border: '1px solid #334155' }}
                        labelStyle={{ color: '#cbd5e1' }}
                      />
                      <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </section>

        {loading && <p className="text-sm text-slate-500">Analyzing habits…</p>}

        {error && (
          <div
            className="rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            {error}
          </div>
        )}

        {data && !loading && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800/90 bg-slate-900/50 p-6 shadow-xl shadow-black/20">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Weakest habit
                </h2>
                {data.weakestHabit ? (
                  <>
                    <p className="mt-3 text-xl font-semibold text-white">{data.weakestHabit.name}</p>
                    <p className="mt-2 text-sm text-slate-400">
                      <span className="text-rose-300/90">{data.weakestHabit.missRate}%</span> of
                      logged days are misses ·{' '}
                      <span className="text-emerald-300/90">
                        {data.weakestHabit.consistencyPercent}%
                      </span>{' '}
                      done
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Based on {data.weakestHabit.totalCheckIns} check-ins (≥2 required).
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Not enough overlapping logs to rank a weakest habit yet.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-800/90 bg-slate-900/50 p-6 shadow-xl shadow-black/20">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Consistency
                </h2>
                <div className="mt-4 flex items-center gap-5">
                  <div className="relative h-24 w-24 shrink-0">
                    <svg className="-rotate-90" width="96" height="96" viewBox="0 0 96 96">
                      <circle
                        cx="48"
                        cy="48"
                        r="45"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="text-slate-800"
                      />
                      {pct != null && (
                        <circle
                          cx="48"
                          cy="48"
                          r="45"
                          fill="none"
                          stroke="url(#ins)"
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray="283"
                          strokeDashoffset={ringOffset}
                          className="transition-[stroke-dashoffset] duration-700 ease-out"
                        />
                      )}
                      <defs>
                        <linearGradient id="ins" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#22d3ee" />
                          <stop offset="100%" stopColor="#34d399" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold tabular-nums text-white">
                        {pct == null ? '—' : `${pct}%`}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-400">
                    Share of logged days marked <span className="text-emerald-400/90">done</span>{' '}
                    vs <span className="text-rose-400/90">missed</span> across all habits in the
                    window.
                  </p>
                </div>
              </div>
            </div>

            {data.mostMissedHabit && (
              <div className="rounded-2xl border border-rose-900/30 bg-rose-950/20 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wider text-rose-200/80">
                  Most missed (count)
                </p>
                <p className="mt-1 text-sm text-rose-50/90">
                  <span className="font-semibold text-white">{data.mostMissedHabit.name}</span> —{' '}
                  {data.mostMissedHabit.missCount} miss
                  {data.mostMissedHabit.missCount === 1 ? '' : 'es'} logged in the window.
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-slate-800/90 bg-slate-900/40 p-6">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-800/80 pb-4">
                <h2 className="text-sm font-semibold text-white">Insights</h2>
                <p className="text-xs text-slate-500">
                  Streak breaks:{' '}
                  <span className="font-mono text-slate-300">{data.streakBreaks}</span>
                </p>
              </div>
              <ul className="mt-5 space-y-4">
                {(data.insights || []).map((line, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-3 text-sm leading-relaxed text-slate-200"
                  >
                    <span
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-xs font-bold text-cyan-300"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0">{line}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-xs text-slate-600">
                Example phrasing like “after 9PM” needs timestamps in logs; today we only detect{' '}
                <strong className="font-medium text-slate-500">weekday</strong> patterns from
                dates.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
