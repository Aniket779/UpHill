import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatWeekRangeLabel, weekStartMondayLocal } from '../utils/date'
import { apiFetch } from '../lib/api'
import { useSocket } from '../hooks/useSocket'
import { TrashIcon, CheckCircleIcon, FlameIcon } from '../components/Icons'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import EmptyState from '../components/ui/EmptyState'

const apiBase = import.meta.env.VITE_API_URL ?? ''

function clamp(n) {
  const x = Number(n)
  if (Number.isNaN(x)) return 0
  return Math.min(100, Math.max(0, Math.round(x)))
}

function ProgressBar({ value, busy }) {
  const v = clamp(value)
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-tertiary">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-300 ease-out"
        style={{ width: `${v}%` }}
      />
      {busy && <div className="pointer-events-none absolute inset-0 bg-surface/40" aria-hidden />}
    </div>
  )
}

function RingGauge({ value }) {
  const v = clamp(value)
  const r = 36
  const c = 2 * Math.PI * r
  const offset = c * (1 - v / 100)
  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <svg className="-rotate-90 transform" width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-surface-tertiary" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="text-accent transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums text-ink">{v}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-tertiary">avg</span>
      </div>
    </div>
  )
}

export default function WeeklyGoalsPage() {
  const weekKey = weekStartMondayLocal()
  const weekLabel = useMemo(() => formatWeekRangeLabel(weekKey), [weekKey])

  const [goals, setGoals] = useState([])
  const [tasks, setTasks] = useState([])
  const [habits, setHabits] = useState([])
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

  const loadLinkedItems = useCallback(async () => {
    try {
      const [tasksRes, habitsRes] = await Promise.all([
        apiFetch(`${apiBase}/tasks/board`),
        apiFetch(`${apiBase}/habits`),
      ])
      setTasks(tasksRes.ok ? await tasksRes.json() : [])
      setHabits(habitsRes.ok ? await habitsRes.json() : [])
    } catch {
      setTasks([])
      setHabits([])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      await Promise.all([load(), loadLinkedItems()])
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [load, loadLinkedItems])

  // ── Real-time socket listeners ─────────────────────────────────────────────
  useSocket('goal:updated', (updatedGoal) => {
    setGoals((prev) => {
      if (!prev.some((g) => g._id === updatedGoal._id)) return prev
      return prev.map((g) => (g._id === updatedGoal._id ? updatedGoal : g))
    })
  })

  useSocket('goal:deleted', ({ _id }) => {
    setGoals((prev) => prev.filter((g) => g._id !== _id))
  })

  useSocket('task:updated', (updatedTask) => {
    setTasks((prev) => prev.map((t) => (t._id === updatedTask._id ? updatedTask : t)))
  })

  useSocket('task:deleted', ({ _id }) => {
    setTasks((prev) => prev.filter((t) => t._id !== _id))
  })

  useSocket('habit:updated', (updatedHabit) => {
    setHabits((prev) => prev.map((h) => (h._id === String(updatedHabit._id) ? updatedHabit : h)))
  })

  useSocket('habit:deleted', ({ _id }) => {
    setHabits((prev) => prev.filter((h) => h._id !== _id))
  })
  // ──────────────────────────────────────────────────────────────────────────

  async function deleteGoal(id) {
    if (!window.confirm('Delete this goal? Linked tasks and habits will be unlinked, not deleted.')) return
    setError(null)
    const res = await apiFetch(`${apiBase}/goals/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError('Could not delete goal.')
      return
    }
    setGoals((prev) => prev.filter((g) => g._id !== id))
  }

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
    <div className="mx-auto max-w-3xl">
      <header className="mb-8 flex flex-col gap-6 border-b border-border pb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-tertiary">
            Weekly goals
          </p>
          <h1 className="mt-1.5 text-display text-ink">This week</h1>
          <p className="mt-2 text-sm text-ink-secondary">{weekLabel}</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-tertiary">
            Set a few outcomes for the week and nudge progress as you ship. Weeks start on Monday.
          </p>
        </div>
        <Card className="flex items-center gap-5" padding="px-6 py-5">
          <RingGauge value={avgProgress} />
          <dl className="min-w-0 space-y-2 text-sm">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">Goals</dt>
              <dd className="text-lg font-semibold text-ink">{goals.length}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">Week id</dt>
              <dd className="truncate font-mono text-xs text-ink-tertiary">{weekKey}</dd>
            </div>
          </dl>
        </Card>
      </header>

      <Card className="mb-8">
        <h2 className="text-sm font-semibold text-ink">Add a weekly goal</h2>
        <form onSubmit={addGoal} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Ship v1 of the planner"
            className="min-w-0 flex-1"
          />
          <Input
            type="number"
            min={1}
            value={target}
            onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 1))}
            className="w-28"
            aria-label="Goal target"
          />
          <Button type="submit" className="shrink-0">
            Add goal
          </Button>
        </form>
      </Card>

      {error && (
        <p className="mb-6 rounded-control border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ink-tertiary">Loading goals…</p>
      ) : goals.length === 0 ? (
        <EmptyState title="No goals for this week yet" />
      ) : (
        <ul className="space-y-4">
          {goals.map((g) => {
            const val = displayProgress(g)
            const targetValue = Math.max(1, Number(g.target) || 100)
            const pct = Math.min(100, Math.round((val / targetValue) * 100))
            const busy = savingId === g._id
            const linkedTasks = tasks.filter((t) => t.goalId === g._id)
            const linkedHabits = habits.filter((h) => h.goalId === g._id)
            const hasLinked = linkedTasks.length > 0 || linkedHabits.length > 0
            return (
              <li key={g._id}>
                <Card>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug text-ink">{g.title}</p>
                      <p className="mt-1 text-xs text-ink-tertiary">
                        Progress: {val}/{targetValue} ({pct}%)
                        {hasLinked && (
                          <span className="ml-2">
                            · {linkedTasks.filter((t) => t.completed).length}/{linkedTasks.length} tasks
                            {linkedHabits.length > 0 && `, ${linkedHabits.length} habit${linkedHabits.length === 1 ? '' : 's'}`} linked
                          </span>
                        )}
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
                        className="w-20 rounded-control border border-border-strong bg-surface px-2 py-2 text-center text-sm font-semibold tabular-nums text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-50"
                      />
                      <span className="text-sm font-medium text-ink-tertiary">pts</span>
                      <button
                        type="button"
                        onClick={() => deleteGoal(g._id)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-ink-tertiary transition-colors hover:bg-danger-soft hover:text-danger"
                        aria-label="Delete goal"
                        title="Delete goal"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-ink-tertiary">
                      <span>Progress</span>
                      <span className="tabular-nums text-ink-secondary">{val}/{targetValue}</span>
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
                      className="mt-1 h-2 w-full cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Adjust progress for ${g.title}`}
                    />
                  </div>
                  {hasLinked && (
                    <div className="mt-4 space-y-1.5 border-t border-border pt-3">
                      {linkedTasks.map((t) => (
                        <div key={t._id} className="flex items-center gap-2 text-xs">
                          <CheckCircleIcon className={`h-3.5 w-3.5 shrink-0 ${t.completed ? 'text-success' : 'text-ink-tertiary'}`} />
                          <span className={`truncate ${t.completed ? 'text-ink-tertiary line-through' : 'text-ink-secondary'}`}>
                            {t.title}
                          </span>
                        </div>
                      ))}
                      {linkedHabits.map((h) => (
                        <div key={h._id} className="flex items-center gap-2 text-xs">
                          <FlameIcon className="h-3.5 w-3.5 shrink-0 text-warning" />
                          <span className="truncate text-ink-secondary">{h.name}</span>
                          <span className="text-ink-tertiary">· {h.streak ?? 0} day streak</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
