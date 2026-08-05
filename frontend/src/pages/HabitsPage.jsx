import { useCallback, useEffect, useMemo, useState } from 'react'
import { todayLocalString } from '../utils/date'
import { apiFetch } from '../lib/api'
import { useSocket } from '../hooks/useSocket'
import { FlameIcon, CheckCircleIcon, TrashIcon, TargetIcon } from '../components/Icons'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import EmptyState from '../components/ui/EmptyState'

const apiBase = import.meta.env.VITE_API_URL ?? ''
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function todayLog(habit) {
  const t = todayLocalString()
  return habit.logs?.find((l) => l.date === t)
}

function scheduleLabel(scheduledDays) {
  if (!scheduledDays || scheduledDays.length === 0 || scheduledDays.length === 7) return null
  return scheduledDays.map((d) => DAY_NAMES[d]).join('/')
}

function HabitActivityGrid({ logs }) {
  const days = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dayOfWeek = today.getDay()
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - dayOfWeek - (12 * 7))

    const arr = []
    for (let i = 0; i < 91; i++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      const isFuture = d > today
      const log = logs?.find(l => l.date === ymd)
      const isDone = log?.status === 'done'

      arr.push({ ymd, isFuture, isDone })
    }
    return arr
  }, [logs])

  return (
    <div className="mt-2 flex overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="grid grid-rows-7 grid-flow-col gap-[3px]">
        {days.map((day) => (
          <div
            key={day.ymd}
            title={day.isFuture ? '' : `${day.ymd}: ${day.isDone ? 'Done' : 'Missed'}`}
            className={`h-2.5 w-2.5 rounded-[2px] transition-colors ${
              day.isFuture
                ? 'bg-transparent'
                : day.isDone
                  ? 'bg-success'
                  : 'bg-surface-tertiary hover:bg-border-strong'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

export default function HabitsPage() {
  const [habits, setHabits] = useState([])
  const [goals, setGoals] = useState([])
  const [name, setName] = useState('')
  const [scheduleDays, setScheduleDays] = useState([])
  const [goalId, setGoalId] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await apiFetch(`${apiBase}/habits`)
    if (!res.ok) {
      setError('Could not load habits.')
      setHabits([])
      return
    }
    const data = await res.json()
    setHabits(data)
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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch(`${apiBase}/goals`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data)) setGoals(data)
      } catch {
        if (!cancelled) setGoals([])
      }
    })()
    return () => { cancelled = true }
  }, [])
  const goalById = useMemo(() => new Map(goals.map((g) => [g._id, g])), [goals])

  // ── Real-time socket listeners ─────────────────────────────────────────────
  useSocket('habit:updated', (updatedHabit) => {
    setHabits((prev) => {
      if (!prev.some((h) => h._id === String(updatedHabit._id))) return prev
      return prev.map((h) => (h._id === String(updatedHabit._id) ? updatedHabit : h))
    })
  })

  useSocket('habit:deleted', ({ _id }) => {
    setHabits((prev) => prev.filter((h) => h._id !== _id))
  })
  // ──────────────────────────────────────────────────────────────────────────

  function toggleScheduleDay(dow) {
    setScheduleDays((prev) => (prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort()))
  }

  async function addHabit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setError(null)
    const res = await apiFetch(`${apiBase}/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed, scheduledDays: scheduleDays, goalId: goalId || null }),
    })
    if (!res.ok) {
      setError('Could not create habit.')
      return
    }
    setName('')
    setScheduleDays([])
    setGoalId('')
    await load()
  }

  async function deleteHabit(id) {
    if (!window.confirm('Delete this habit? Its history will be lost.')) return
    setError(null)
    const res = await apiFetch(`${apiBase}/habits/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError('Could not delete habit.')
      return
    }
    setHabits((prev) => prev.filter((h) => h._id !== id))
  }

  async function markDone(id) {
    setSavingId(id)
    setError(null)
    try {
      const res = await apiFetch(`${apiBase}/habits/${id}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      })
      if (!res.ok) {
        setError('Could not save log.')
        return
      }
      const updated = await res.json()
      setHabits((prev) => prev.map((h) => (h._id === id ? updated : h)))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <h1 className="text-display text-ink">Habits</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-tertiary">
          Build streaks by logging each habit once per day. Today&apos;s status updates instantly.
        </p>
      </header>

      <Card padding="p-4" className="mb-6">
        <form onSubmit={addHabit} className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New habit name"
              className="min-w-0 flex-1"
            />
            <Button type="submit" className="shrink-0">
              Add habit
            </Button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                Days
              </span>
              <div className="flex gap-1" role="group" aria-label="Scheduled days">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleScheduleDay(i)}
                    aria-pressed={scheduleDays.includes(i)}
                    title={DAY_NAMES[i]}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors ${
                      scheduleDays.includes(i)
                        ? 'border-accent bg-accent text-white'
                        : 'border-border-strong bg-surface text-ink-tertiary hover:text-ink-secondary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-ink-tertiary">
                {scheduleDays.length === 0 ? '(every day)' : ''}
              </span>
            </div>
            <Select value={goalId} onChange={(e) => setGoalId(e.target.value)} className="sm:w-56">
              <option value="">no goal</option>
              {goals.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.title}
                </option>
              ))}
            </Select>
          </div>
        </form>
      </Card>

      {error && (
        <p className="mb-6 rounded-control border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-center text-sm text-ink-tertiary">Loading habits…</p>
      ) : habits.length === 0 ? (
        <EmptyState title="No habits yet" description="Add your first one above." />
      ) : (
        <ul className="space-y-2.5">
          {habits.map((h) => {
            const log = todayLog(h)
            const doneToday = log?.status === 'done'
            return (
              <li key={h._id}>
                <Card padding="px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 truncate font-medium text-ink">
                        <span className="truncate">{h.name}</span>
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-chip bg-warning-soft px-2 py-0.5 text-xs font-semibold tabular-nums text-warning"
                          title="Current streak (consecutive done days)"
                        >
                          <FlameIcon className="h-3 w-3" />
                          {h.streak ?? 0}
                        </span>
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-tertiary">
                        {doneToday ? (
                          <span className="inline-flex items-center gap-1 text-success">
                            <CheckCircleIcon className="h-3 w-3" /> Done today
                          </span>
                        ) : log?.status === 'missed' ? (
                          <span className="text-priority-medium">Missed today</span>
                        ) : (
                          'Not logged today'
                        )}
                        {scheduleLabel(h.scheduledDays) && (
                          <span className="rounded-chip bg-surface-secondary px-2 py-0.5 font-medium text-ink-secondary">
                            {scheduleLabel(h.scheduledDays)}
                          </span>
                        )}
                        {h.goalId && goalById.get(h.goalId) && (
                          <span className="inline-flex max-w-[140px] items-center gap-1 truncate rounded-chip bg-accent-soft px-2 py-0.5 font-medium text-accent">
                            <TargetIcon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{goalById.get(h.goalId).title}</span>
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant={doneToday ? 'secondary' : 'primary'}
                        disabled={doneToday || savingId === h._id}
                        onClick={() => markDone(h._id)}
                      >
                        {savingId === h._id ? '…' : doneToday ? 'Done' : 'Mark done'}
                      </Button>
                      <button
                        type="button"
                        onClick={() => deleteHabit(h._id)}
                        className="flex h-9 w-9 items-center justify-center rounded-control text-ink-tertiary transition-colors hover:bg-danger-soft hover:text-danger"
                        aria-label="Delete habit"
                        title="Delete habit"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <HabitActivityGrid logs={h.logs} />
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
