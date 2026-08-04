import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { formatHeading, todayLocalString, addDays, getShortWeekday, getNumericDay } from '../utils/date'
import { apiFetch } from '../lib/api'
import { useSocket } from '../hooks/useSocket'
import AgentSuggestion from '../components/AgentSuggestion'
import { CalendarIcon, ClockIcon } from '../components/Icons'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'

const apiBase = import.meta.env.VITE_API_URL ?? ''



const PRIORITIES = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
]

function priorityStyles(priority, completed) {
  if (completed) {
    return {
      row: 'border-border bg-surface opacity-60',
      accent: 'bg-ink-tertiary',
      badge: 'low',
    }
  }
  if (priority === 'high') {
    return {
      row: 'border-border bg-surface border-l-[3px] border-l-priority-high',
      accent: 'bg-priority-high',
      badge: 'high',
    }
  }
  if (priority === 'medium') {
    return {
      row: 'border-border bg-surface border-l-[3px] border-l-priority-medium',
      accent: 'bg-priority-medium',
      badge: 'medium',
    }
  }
  return {
    row: 'border-border bg-surface border-l-[3px] border-l-priority-low',
    accent: 'bg-priority-low',
    badge: 'low',
  }
}

function PriorityChip({ id, active, onClick }) {
  const label = { low: 'Low', medium: 'Medium', high: 'High' }[id]
  const activeStyles = {
    high: 'border-priority-high bg-priority-high-soft text-priority-high',
    medium: 'border-priority-medium bg-priority-medium-soft text-priority-medium',
    low: 'border-ink-tertiary bg-surface-secondary text-ink-secondary',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-control border px-3 py-2 text-xs font-semibold transition-colors ${
        active ? activeStyles[id] : 'border-border-strong bg-surface text-ink-tertiary hover:text-ink-secondary'
      }`}
    >
      {label}
    </button>
  )
}

export default function TodayPage() {
  const { date } = useParams()
  const navigate = useNavigate()
  const activeDate = date || todayLocalString()
  const isToday = activeDate === todayLocalString()

  const [tasks, setTasks] = useState([])
  const [goals, setGoals] = useState([])
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [category, setCategory] = useState('general')
  const [tagsInput, setTagsInput] = useState('')
  const [goalId, setGoalId] = useState('')
  const [breakdownLoading, setBreakdownLoading] = useState(false)
  const [filterCategory, setFilterCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [patchingId, setPatchingId] = useState(null)
  const [error, setError] = useState(null)

  // Scheduling Modal State
  const [scheduleTask, setScheduleTask] = useState(null)
  const [scheduleStart, setScheduleStart] = useState('09:00')
  const [scheduleDuration, setScheduleDuration] = useState('60')

  const load = useCallback(async () => {
    setError(null)
    const qp = new URLSearchParams({ date: activeDate })
    if (filterCategory !== 'all') qp.set('category', filterCategory)
    const res = await apiFetch(`${apiBase}/tasks?${qp.toString()}`)
    if (!res.ok) {
      setError('Could not load today’s tasks.')
      setTasks([])
      return
    }
    const data = await res.json()
    setTasks(data)
  }, [filterCategory, activeDate])

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      await load()
      if (!cancelled) setLoading(false)
    }

    fetchData()

    const handleTaskAdded = () => void load()
    window.addEventListener('task-added', handleTaskAdded)

    return () => {
      cancelled = true
      window.removeEventListener('task-added', handleTaskAdded)
    }
  }, [load])

  // ── Real-time socket listeners ─────────────────────────────────────────────
  useSocket('task:created', (newTask) => {
    // Only add to this view if the task belongs to the currently displayed date
    if (newTask.date !== activeDate) return
    setTasks((prev) => {
      // Guard against duplicates (own tab already has it via the REST response)
      if (prev.some((t) => t._id === newTask._id)) return prev
      const next = [newTask, ...prev]
      const rank = { high: 0, medium: 1, low: 2 }
      next.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1
        return rank[a.priority] - rank[b.priority]
      })
      return next
    })
  })

  useSocket('task:updated', (updatedTask) => {
    setTasks((prev) => {
      if (!prev.some((t) => t._id === updatedTask._id)) return prev
      const next = prev.map((t) => (t._id === updatedTask._id ? updatedTask : t))
      const rank = { high: 0, medium: 1, low: 2 }
      next.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1
        return rank[a.priority] - rank[b.priority]
      })
      return next
    })
  })
  // ──────────────────────────────────────────────────────────────────────────

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



  async function addTask(e) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setError(null)
    const res = await apiFetch(`${apiBase}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: trimmed,
        priority,
        date: activeDate,
        category,
        tags: tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        goalId: goalId || null,
      }),
    })
    if (!res.ok) {
      setError('Could not create task.')
      return
    }
    setTitle('')
    setPriority('medium')
    setCategory('general')
    setTagsInput('')
    setGoalId('')
    await load()
  }

  async function breakIntoTasks() {
    const goalText = title.trim()
    if (!goalText || breakdownLoading) return
    setBreakdownLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`${apiBase}/ai/breakdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalText }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !Array.isArray(data.tasks)) {
        setError(data.error || 'Could not break goal into tasks.')
        return
      }
      const results = await Promise.all(
        data.tasks.map((taskTitle) =>
          apiFetch(`${apiBase}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: taskTitle,
              priority,
              date: activeDate,
              category,
              tags: tagsInput
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
              goalId: goalId || null,
            }),
          })
        )
      )
      if (results.some((r) => !r.ok)) {
        setError('Some generated tasks could not be saved.')
        await load()
        return
      }
      setTitle('')
      setTagsInput('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate tasks.')
    } finally {
      setBreakdownLoading(false)
    }
  }

  async function setCompleted(id, completed) {
    setPatchingId(id)
    setError(null)
    try {
      const res = await apiFetch(`${apiBase}/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      })
      if (!res.ok) {
        setError('Could not update task.')
        return
      }
      const updated = await res.json()
      setTasks((prev) => {
        const next = prev.map((t) => (t._id === id ? updated : t))
        const rank = { high: 0, medium: 1, low: 2 }
        next.sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1
          return rank[a.priority] - rank[b.priority]
        })
        return next
      })
    } finally {
      setPatchingId(null)
    }
  }

  async function submitSchedule(e) {
    e.preventDefault()
    if (!scheduleTask) return
    setError(null)
    try {
      const res = await apiFetch(`${apiBase}/tasks/${scheduleTask._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: scheduleStart, duration: parseInt(scheduleDuration, 10) }),
      })
      if (!res.ok) {
        setError('Could not schedule task.')
        return
      }
      setScheduleTask(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const open = tasks.filter((t) => !t.completed)
  const done = tasks.filter((t) => t.completed)
  const scheduledTasks = open.filter(t => t.startTime && t.duration)

  const highOpen = open.filter((t) => t.priority === 'high').length
  const completionPct = tasks.length ? Math.round((done.length / tasks.length) * 100) : null
  const categoryOptions = useMemo(() => {
    const s = new Set(['general', 'work', 'health', 'study', 'personal'])
    tasks.forEach((t) => t.category && s.add(t.category))
    return [...s]
  }, [tasks])

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-col gap-6 pb-6 border-b border-border lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-tertiary">
              {isToday ? 'Today planner' : 'Daily planner'}
            </p>
            <label className="relative flex cursor-pointer items-center justify-center rounded-control border border-border p-1.5 text-ink-tertiary transition-colors hover:bg-surface-secondary hover:text-ink-secondary">
              <CalendarIcon className="h-3.5 w-3.5" />
              <input
                type="date"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                value={activeDate}
                onChange={(e) => {
                  if (e.target.value) {
                    navigate(e.target.value === todayLocalString() ? '/' : `/day/${e.target.value}`)
                  }
                }}
              />
            </label>
          </div>
          <h1 className="mt-1.5 text-display text-ink">
            {formatHeading(activeDate)}
          </h1>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {[-3, -2, -1, 0, 1, 2, 3].map((offset) => {
              const d = addDays(activeDate, offset)
              const isSelected = offset === 0
              const isCurrentDay = d === todayLocalString()
              return (
                <button
                  key={offset}
                  onClick={() => navigate(isCurrentDay ? '/' : `/day/${d}`)}
                  className={`flex min-w-[3.25rem] flex-col items-center justify-center rounded-control border p-2 transition-colors ${
                    isSelected
                      ? 'border-accent bg-accent-soft text-accent'
                      : isCurrentDay
                        ? 'border-border-strong bg-surface-secondary text-ink'
                        : 'border-border bg-surface text-ink-tertiary hover:border-border-strong hover:bg-surface-secondary'
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{getShortWeekday(d)}</span>
                  <span className="mt-0.5 text-base font-semibold leading-none tabular-nums">{getNumericDay(d)}</span>
                  {isCurrentDay && <span className="mt-1 h-1 w-1 rounded-full bg-accent" />}
                </button>
              )
            })}
          </div>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-tertiary">
            {isToday ? 'Plan the day in one place. High-priority items stay visually loud so nothing critical slips past.' : 'Review your past performance or plan your future focus items ahead of time.'}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto lg:min-w-[340px]">
          <Card padding="px-4 py-3">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">Open</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{open.length}</dd>
          </Card>
          <Card padding="px-4 py-3">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">Done</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-success">
              {done.length}
            </dd>
          </Card>
          <div className="rounded-card border border-priority-high/20 bg-priority-high-soft px-4 py-3">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-priority-high/80">
              High · open
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-priority-high">{highOpen}</dd>
          </div>
          <Card padding="px-4 py-3">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">Progress</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">
              {completionPct === null ? '—' : `${completionPct}%`}
            </dd>
          </Card>
        </dl>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">

        {/* Main Content Area (Tasks) */}
        <section className="space-y-6">

          {isToday && <AgentSuggestion onTaskUpdated={load} />}

          <Card>
            <h2 className="text-sm font-semibold text-ink">Add task</h2>
            <form onSubmit={addTask} className="mt-4 space-y-3">
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to happen today?"
              />
              <button
                type="button"
                onClick={() => void breakIntoTasks()}
                disabled={breakdownLoading || !title.trim()}
                className="w-full rounded-control border border-ai-border bg-ai-soft px-4 py-2.5 text-sm font-semibold text-ai transition-colors hover:bg-ai-soft/70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {breakdownLoading ? 'Breaking into tasks…' : 'Break this into tasks'}
              </button>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Priority">
                  {PRIORITIES.map((p) => (
                    <PriorityChip key={p.id} id={p.id} active={priority === p.id} onClick={() => setPriority(p.id)} />
                  ))}
                </div>
                <Button type="submit">
                  Add to today
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="general">general</option>
                  <option value="work">work</option>
                  <option value="health">health</option>
                  <option value="study">study</option>
                  <option value="personal">personal</option>
                </Select>
                <Input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="tags: deep work, gym"
                />
                <Select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
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

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-tertiary">Filter category</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-control border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-secondary focus:border-accent focus:outline-none"
            >
              <option value="all">all</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="rounded-control border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          {loading ? (
            <p className="text-sm text-ink-tertiary">Loading tasks…</p>
          ) : tasks.length === 0 ? (
            <EmptyState title="No tasks for today" description="Add your first task above to get started." />
          ) : (
            <div className="space-y-8">
              {open.length > 0 && (
                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-tertiary">
                    In progress
                  </h3>
                  <ul className="space-y-2.5">
                    {open.map((t) => {
                      const s = priorityStyles(t.priority, false)
                      return (
                        <li
                          key={t._id}
                          className={`flex flex-col sm:flex-row sm:items-center gap-4 rounded-card border px-4 py-4 transition-colors ${s.row}`}
                        >
                          <div className="flex flex-1 items-start gap-3.5">
                            <button
                              type="button"
                              disabled={patchingId === t._id}
                              onClick={() => setCompleted(t._id, true)}
                              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-border-strong bg-surface transition-colors hover:border-accent disabled:opacity-50"
                              aria-label="Mark complete"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={s.badge}>{t.priority}</Badge>
                                {t.startTime && (
                                  <span className="inline-flex items-center gap-1 rounded-chip bg-surface-secondary px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
                                    <ClockIcon className="h-3 w-3" />
                                    {t.startTime} · {t.duration}m
                                  </span>
                                )}
                              </div>
                              <p className="mt-1.5 text-sm font-medium leading-snug text-ink">
                                {t.title}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:self-center ml-9 sm:ml-0">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setScheduleTask(t)}
                            >
                              {t.startTime ? 'Reschedule' : 'Schedule'}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={patchingId === t._id}
                              onClick={() => setCompleted(t._id, true)}
                            >
                              {patchingId === t._id ? '…' : 'Complete'}
                            </Button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              {done.length > 0 && (
                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-tertiary">
                    Completed
                  </h3>
                  <ul className="space-y-2">
                    {done.map((t) => {
                      const s = priorityStyles(t.priority, true)
                      return (
                        <li
                          key={t._id}
                          className={`flex items-center gap-3 rounded-control border px-4 py-3 ${s.row}`}
                        >
                          <button
                            type="button"
                            disabled={patchingId === t._id}
                            onClick={() => setCompleted(t._id, false)}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-success bg-success-soft text-success text-xs"
                            aria-label="Mark incomplete"
                          >
                            ✓
                          </button>
                          <p className="min-w-0 flex-1 truncate text-sm text-ink-tertiary line-through">
                            {t.title}
                          </p>
                          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
                            {t.priority}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Timeline Aside Area */}
        <aside className="rounded-card border border-border bg-surface lg:block overflow-hidden flex flex-col h-[780px]">
          <div className="p-4 border-b border-border shrink-0">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-tertiary">Daily Timeline</h2>
            <p className="text-xs text-ink-tertiary mt-1">Time block your scheduled tasks.</p>
          </div>
          <div className="flex-1 overflow-y-auto relative bg-surface">
            <div className="relative w-full" style={{ height: `${24 * 60}px` }}>
              {/* Hourly Grid */}
              {[...Array(24)].map((_, i) => (
                <div key={i} className="absolute w-full border-t border-border" style={{ top: `${i * 60}px` }}>
                  <span className="absolute -top-2.5 left-2 bg-surface px-1 text-[10px] font-mono text-ink-tertiary">
                    {String(i).padStart(2, '0')}:00
                  </span>
                </div>
              ))}

              {/* Scheduled Tasks on Timeline */}
              {scheduledTasks.map(t => {
                const [h, m] = t.startTime.split(':').map(Number)
                const top = (h * 60) + m
                const height = t.duration

                const colorClass = t.priority === 'high'
                  ? 'border-priority-high/40 bg-priority-high-soft text-priority-high'
                  : t.priority === 'medium'
                  ? 'border-priority-medium/40 bg-priority-medium-soft text-priority-medium'
                  : 'border-accent-border bg-accent-soft text-accent'

                return (
                  <div
                    key={t._id}
                    className={`absolute left-14 right-4 rounded-control border p-2 overflow-hidden flex flex-col justify-center transition hover:shadow-card cursor-pointer ${colorClass}`}
                    style={{ top: `${top}px`, height: `${height}px` }}
                    onClick={() => setScheduleTask(t)}
                  >
                    <p className="text-xs font-semibold truncate leading-tight">{t.title}</p>
                    {height >= 30 && (
                      <p className="text-[10px] opacity-70 truncate mt-0.5">{t.startTime} • {t.duration}m</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* Schedule Modal Overlay */}
      {scheduleTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/20 backdrop-blur-sm" onClick={() => setScheduleTask(null)}></div>
          <div className="relative w-full max-w-md rounded-card border border-border bg-surface shadow-modal p-6">
            <h3 className="text-base font-semibold text-ink mb-1">Schedule Task</h3>
            <p className="text-sm text-ink-tertiary mb-6 truncate">{scheduleTask.title}</p>

            <form onSubmit={submitSchedule} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wide text-ink-tertiary mb-2">Start Time</label>
                  <Input
                    type="time"
                    value={scheduleStart}
                    onChange={(e) => setScheduleStart(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wide text-ink-tertiary mb-2">Duration (mins)</label>
                  <Select value={scheduleDuration} onChange={(e) => setScheduleDuration(e.target.value)}>
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                    <option value="240">4 hours</option>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setScheduleTask(null)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save Schedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
