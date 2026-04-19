import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatWeekRangeLabel, weekStartMondayLocal } from '../utils/date'
import { apiFetch } from '../lib/api'

const apiBase = import.meta.env.VITE_API_URL ?? ''

function clamp(n) {
  const x = Number(n)
  if (Number.isNaN(x)) return 0
  return Math.min(100, Math.max(0, Math.round(x)))
}

function ProgressBar({ value, busy }) {
  const v = clamp(value)
  return (
    <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-800/90 ring-1 ring-white/5">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-400 transition-[width] duration-300 ease-out"
        style={{ width: `${v}%` }}
      />
      {busy && (
        <div
          className="pointer-events-none absolute inset-0 bg-slate-950/25"
          aria-hidden
        />
      )}
    </div>
  )
}

function RingGauge({ value }) {
  const v = clamp(value)
  const r = 36
  const c = 2 * Math.PI * r
  const offset = c * (1 - v / 100)
  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg className="-rotate-90 transform" width="112" height="112" viewBox="0 0 112 112">
        <circle
          cx="56"
          cy="56"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-slate-800"
        />
        <circle
          cx="56"
          cy="56"
          r={r}
          fill="none"
          stroke="url(#wg)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
        <defs>
          <linearGradient id="wg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="55%" stopColor="#e879f9" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums text-white">{v}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          avg
        </span>
      </div>
    </div>
  )
}

export default function WeeklyGoalsPage() {
  const weekKey = weekStartMondayLocal()
  const weekLabel = useMemo(() => formatWeekRangeLabel(weekKey), [weekKey])

  const [goals, setGoals] = useState([])
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState(100)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [savingId, setSavingId] = useState(null)
  /** Local slider values while dragging */
  const [drag, setDrag] = useState({})

  const load = useCallback(async () => {
    setError(null)
    const res = await apiFetch(`${apiBase}/goals`)
    if (!res.ok) {
      setError('Could not load weekly goals.')
      setGoals([])
      return
    }
    const data = await res.json()
    setGoals(data)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      await load()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [load])

  const avgProgress = useMemo(() => {
    if (!goals.length) return 0
    return Math.round(
      goals.reduce((s, g) => {
        const t = Math.max(1, Number(g.target) || 100)
        const p = clamp(g.progress)
        return s + Math.round((p / t) * 100)
      }, 0) / goals.length
    )
  }, [goals])

  async function addGoal(e) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setError(null)
    const res = await apiFetch(`${apiBase}/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed, target }),
    })
    if (!res.ok) {
      setError('Could not create goal.')
      return
    }
    setTitle('')
    setTarget(100)
    await load()
  }

  async function patchProgress(id, progress) {
    const p = clamp(progress)
    setSavingId(id)
    setError(null)
    try {
      const res = await apiFetch(`${apiBase}/goals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: p }),
      })
      if (!res.ok) {
        setError('Could not update progress.')
        return
      }
      const updated = await res.json()
      setGoals((prev) => prev.map((g) => (g._id === id ? updated : g)))
      setDrag((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } finally {
      setSavingId(null)
    }
  }

  function displayProgress(g) {
    return drag[g._id] !== undefined ? drag[g._id] : clamp(g.progress)
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 flex flex-col gap-8 border-b border-slate-800/80 pb-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/90">
              Weekly goals
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              This week
            </h1>
            <p className="mt-2 text-sm text-slate-400">{weekLabel}</p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
              Set a few outcomes for the week and nudge progress as you ship. Weeks start on
              Monday.
            </p>
          </div>
          <div className="flex items-center gap-6 rounded-2xl border border-slate-800/80 bg-slate-900/40 px-6 py-5">
            <RingGauge value={avgProgress} />
            <dl className="min-w-0 space-y-2 text-sm">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Goals
                </dt>
                <dd className="text-lg font-semibold text-white">{goals.length}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Week id
                </dt>
                <dd className="truncate font-mono text-xs text-slate-400">{weekKey}</dd>
              </div>
            </dl>
          </div>
        </header>

        <section className="mb-10 rounded-2xl border border-slate-800/80 bg-slate-900/35 p-5 shadow-xl shadow-black/25 backdrop-blur-md">
          <h2 className="text-sm font-semibold text-white">Add a weekly goal</h2>
          <form onSubmit={addGoal} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Ship v1 of the planner"
              className="min-w-0 flex-1 rounded-xl border border-slate-700/80 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-500/45 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
            />
                <input
                  type="number"
                  min={1}
                  value={target}
                  onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 1))}
                  className="w-28 rounded-xl border border-slate-700/80 bg-slate-950/70 px-3 py-3 text-sm text-white focus:border-violet-500/45 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
                  aria-label="Goal target"
                />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 active:bg-violet-700"
            >
              Add goal
            </button>
          </form>
        </section>

        {error && (
          <p
            className="mb-6 rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading goals…</p>
        ) : goals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center">
            <p className="text-sm text-slate-500">No goals for this week yet.</p>
          </div>
        ) : (
          <ul className="space-y-5">
            {goals.map((g) => {
              const val = displayProgress(g)
              const targetValue = Math.max(1, Number(g.target) || 100)
              const pct = Math.min(100, Math.round((val / targetValue) * 100))
              const busy = savingId === g._id
              return (
                <li
                  key={g._id}
                  className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-slate-950/80 p-5 shadow-lg shadow-black/20"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug text-white">{g.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Progress: {val}/{targetValue} ({pct}%)
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:shrink-0">
                      <label className="sr-only" htmlFor={`pct-${g._id}`}>
                        Progress percent
                      </label>
                      <input
                        id={`pct-${g._id}`}
                        type="number"
                        min={0}
                        max={targetValue}
                        value={val}
                        disabled={busy}
                        onChange={(e) =>
                          setDrag((prev) => ({ ...prev, [g._id]: clamp(e.target.value) }))
                        }
                        onBlur={() => {
                          if (drag[g._id] === undefined) return
                          if (drag[g._id] !== clamp(g.progress)) {
                            void patchProgress(g._id, drag[g._id])
                          } else {
                            setDrag((prev) => {
                              const n = { ...prev }
                              delete n[g._id]
                              return n
                            })
                          }
                        }}
                        className="w-20 rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-2 text-center text-sm font-semibold tabular-nums text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15 disabled:opacity-50"
                      />
                      <span className="text-sm font-medium text-slate-500">pts</span>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Progress</span>
                      <span className="tabular-nums text-slate-400">{val}/{targetValue}</span>
                    </div>
                    <ProgressBar value={pct} busy={busy} />
                    <input
                      type="range"
                      min={0}
                      max={targetValue}
                      value={val}
                      disabled={busy}
                      onChange={(e) => {
                        const n = clamp(e.target.value)
                        setDrag((prev) => ({ ...prev, [g._id]: n }))
                      }}
                      onPointerUp={(e) => {
                        const n = clamp(e.currentTarget.value)
                        void patchProgress(g._id, n)
                      }}
                      className="mt-1 h-2 w-full cursor-pointer accent-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Adjust progress for ${g.title}`}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
