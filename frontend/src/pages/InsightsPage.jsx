import { useEffect, useState } from 'react'

const apiBase = import.meta.env.VITE_API_URL ?? ''

export default function InsightsPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setError(null)
      try {
        const res = await fetch(`${apiBase}/insights`)
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
