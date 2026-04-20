import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { formatHeading, todayLocalString, addDays, getShortWeekday, getNumericDay } from '../utils/date'
import { apiFetch } from '../lib/api'

const apiBase = import.meta.env.VITE_API_URL ?? ''

const PRIORITIES = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
]

function priorityStyles(priority, completed) {
  if (completed) {
    return {
      row: 'border-slate-800/60 bg-slate-900/25 opacity-70',
      accent: 'bg-slate-700',
      pill: 'text-slate-500 border-slate-700',
    }
  }
  if (priority === 'high') {
    return {
      row: 'border-rose-500/35 bg-gradient-to-r from-rose-950/40 via-slate-900/50 to-slate-900/40 shadow-[inset_4px_0_0_0_rgba(244,63,94,0.65)]',
      accent: 'bg-rose-500',
      pill: 'text-rose-200 border-rose-500/40 bg-rose-950/50',
    }
  }
  if (priority === 'medium') {
    return {
      row: 'border-amber-500/20 bg-slate-900/45',
      accent: 'bg-amber-500',
      pill: 'text-amber-100/90 border-amber-500/30 bg-amber-950/35',
    }
  }
  return {
    row: 'border-slate-800/80 bg-slate-900/40',
    accent: 'bg-slate-500',
    pill: 'text-slate-400 border-slate-700 bg-slate-950/50',
  }
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
    return () => {
      cancelled = true
    }
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
  const categoryOptions = useMemo(() => {
    const s = new Set(['general', 'work', 'health', 'study', 'personal'])
    tasks.forEach((t) => t.category && s.add(t.category))
    return [...s]
  }, [tasks])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="rounded-3xl border border-white/5 bg-white/[0.02] shadow-2xl backdrop-blur-3xl p-6 lg:p-10 mb-8 relative">
        <header className="mb-10 flex flex-col gap-6 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400/90">
                {isToday ? 'Today planner' : 'Daily planner'}
              </p>
              <label className="relative flex cursor-pointer items-center justify-center rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-400 transition hover:bg-slate-700 hover:text-slate-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></svg>
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
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {formatHeading(activeDate)}
            </h1>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {[-3, -2, -1, 0, 1, 2, 3].map((offset) => {
                const d = addDays(activeDate, offset)
                const isSelected = offset === 0
                const isCurrentDay = d === todayLocalString()
                return (
                  <button
                    key={offset}
                    onClick={() => navigate(isCurrentDay ? '/' : `/day/${d}`)}
                    className={`flex min-w-[3.5rem] flex-col items-center justify-center rounded-xl border p-2 transition ${
                      isSelected
                        ? 'border-sky-500/50 bg-sky-900/40 text-white shadow-[0_0_15px_rgba(14,165,233,0.15)]'
                        : isCurrentDay
                          ? 'border-slate-600 bg-slate-800/80 text-slate-200'
                          : 'border-slate-800/80 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{getShortWeekday(d)}</span>
                    <span className="mt-1 text-lg font-semibold leading-none">{getNumericDay(d)}</span>
                    {isCurrentDay && <span className="mt-1 h-1 w-1 rounded-full bg-sky-400"></span>}
                  </button>
                )
              })}
            </div>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
              {isToday ? 'Plan the day in one place. High-priority items stay visually loud so nothing critical slips past.' : 'Review your past performance or plan your future focus items ahead of time.'}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-auto lg:min-w-[280px]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Open</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">{open.length}</dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Done</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-emerald-400/90">
                {done.length}
              </dd>
            </div>
            <div className="col-span-2 rounded-2xl border border-rose-500/25 bg-rose-950/20 px-4 py-3 sm:col-span-1">
              <dt className="text-[11px] font-medium uppercase tracking-wider text-rose-200/70">
                High · open
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-rose-100">{highOpen}</dd>
            </div>
          </dl>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
          
          {/* Main Content Area (Tasks) */}
          <section className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-black/40 backdrop-blur-md">
              <h2 className="text-sm font-semibold text-white">Add task</h2>
              <form onSubmit={addTask} className="mt-4 space-y-4">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs to happen today?"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  onClick={() => void breakIntoTasks()}
                  disabled={breakdownLoading || !title.trim()}
                  className="w-full rounded-xl border border-violet-700/40 bg-violet-950/35 px-4 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-900/45 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {breakdownLoading ? 'Breaking into tasks…' : 'Break this into tasks'}
                </button>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Priority">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPriority(p.id)}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                          priority === p.id
                            ? p.id === 'high'
                              ? 'border-rose-500/50 bg-rose-950/60 text-rose-100'
                              : p.id === 'medium'
                                ? 'border-amber-500/40 bg-amber-950/40 text-amber-100'
                                : 'border-slate-500/40 bg-slate-800 text-slate-200'
                            : 'border-slate-800 bg-slate-950/50 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 active:bg-indigo-600 shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                  >
                    Add to today
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/15"
                  >
                    <option value="general">general</option>
                    <option value="work">work</option>
                    <option value="health">health</option>
                    <option value="study">study</option>
                    <option value="personal">personal</option>
                  </select>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="tags: deep work, gym"
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/15"
                  />
                  <select
                    value={goalId}
                    onChange={(e) => setGoalId(e.target.value)}
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/15"
                  >
                    <option value="">no goal</option>
                    {goals.map((g) => (
                      <option key={g._id} value={g._id}>
                        {g.title}
                      </option>
                    ))}
                  </select>
                </div>
              </form>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-slate-500">Filter category</span>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
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
              <p
                className="rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200"
                role="alert"
              >
                {error}
              </p>
            )}

            {loading ? (
              <p className="text-sm text-slate-500">Loading tasks…</p>
            ) : tasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center">
                <p className="text-sm text-slate-500">No tasks for today. Add your first above.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {open.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      In progress
                    </h3>
                    <ul className="space-y-3">
                      {open.map((t) => {
                        const s = priorityStyles(t.priority, false)
                        return (
                          <li
                            key={t._id}
                            className={`flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border px-4 py-4 backdrop-blur-sm transition ${s.row}`}
                          >
                            <div className="flex flex-1 items-start gap-4">
                              <button
                                type="button"
                                disabled={patchingId === t._id}
                                onClick={() => setCompleted(t._id, true)}
                                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-slate-600 bg-slate-950/60 text-transparent transition hover:border-sky-500/50 disabled:opacity-50"
                                aria-label="Mark complete"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`inline-flex h-1.5 w-1.5 shrink-0 rounded-full ${s.accent}`}
                                    aria-hidden
                                  />
                                  <span
                                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.pill}`}
                                  >
                                    {t.priority}
                                  </span>
                                  {t.startTime && (
                                    <span className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                                      {t.startTime} ({t.duration}m)
                                    </span>
                                  )}
                                </div>
                                <p className="mt-2 text-sm font-medium leading-snug text-white">
                                  {t.title}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:self-center ml-10 sm:ml-0">
                              <button
                                type="button"
                                onClick={() => setScheduleTask(t)}
                                className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
                              >
                                {t.startTime ? 'Reschedule' : 'Schedule'}
                              </button>
                              <button
                                type="button"
                                disabled={patchingId === t._id}
                                onClick={() => setCompleted(t._id, true)}
                                className="shrink-0 rounded-lg border border-sky-700/40 bg-sky-950/40 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-900/50 disabled:opacity-50"
                              >
                                {patchingId === t._id ? '…' : 'Complete'}
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
                {done.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Completed
                    </h3>
                    <ul className="space-y-2">
                      {done.map((t) => {
                        const s = priorityStyles(t.priority, true)
                        return (
                          <li
                            key={t._id}
                            className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${s.row}`}
                          >
                            <button
                              type="button"
                              disabled={patchingId === t._id}
                              onClick={() => setCompleted(t._id, false)}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-emerald-600/50 bg-emerald-950/50 text-emerald-400"
                              aria-label="Mark incomplete"
                            >
                              ✓
                            </button>
                            <p className="min-w-0 flex-1 truncate text-sm text-slate-400 line-through">
                              {t.title}
                            </p>
                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-600">
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
          <aside className="rounded-2xl border border-white/5 bg-white/[0.02] lg:block backdrop-blur-md overflow-hidden flex flex-col h-[800px]">
            <div className="p-4 border-b border-white/5 bg-slate-900/50 shrink-0">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Daily Timeline</h2>
              <p className="text-xs text-slate-400 mt-1">Time block your scheduled tasks.</p>
            </div>
            <div className="flex-1 overflow-y-auto relative bg-slate-950/30">
              <div className="relative w-full" style={{ height: `${24 * 60}px` }}>
                {/* Hourly Grid */}
                {[...Array(24)].map((_, i) => (
                  <div key={i} className="absolute w-full border-t border-white/5" style={{ top: `${i * 60}px` }}>
                    <span className="absolute -top-2.5 left-2 bg-slate-950/80 px-1 text-[10px] text-slate-500 font-medium">
                      {String(i).padStart(2, '0')}:00
                    </span>
                  </div>
                ))}

                {/* Scheduled Tasks on Timeline */}
                {scheduledTasks.map(t => {
                  const [h, m] = t.startTime.split(':').map(Number)
                  const top = (h * 60) + m
                  const height = t.duration
                  
                  // Color based on priority
                  const colorClass = t.priority === 'high' 
                    ? 'border-rose-500/50 bg-rose-500/20 text-rose-200'
                    : t.priority === 'medium'
                    ? 'border-amber-500/50 bg-amber-500/20 text-amber-200'
                    : 'border-indigo-500/50 bg-indigo-500/20 text-indigo-200'

                  return (
                    <div 
                      key={t._id} 
                      className={`absolute left-14 right-4 rounded-xl border p-2 backdrop-blur-md shadow-lg overflow-hidden flex flex-col justify-center transition hover:scale-[1.02] cursor-pointer ${colorClass}`} 
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
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setScheduleTask(null)}></div>
            <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 shadow-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-1">Schedule Task</h3>
              <p className="text-sm text-slate-400 mb-6 truncate">{scheduleTask.title}</p>
              
              <form onSubmit={submitSchedule} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-2">Start Time</label>
                    <input 
                      type="time" 
                      value={scheduleStart}
                      onChange={(e) => setScheduleStart(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-2">Duration (mins)</label>
                    <select 
                      value={scheduleDuration}
                      onChange={(e) => setScheduleDuration(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
                    >
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">1 hour</option>
                      <option value="90">1.5 hours</option>
                      <option value="120">2 hours</option>
                      <option value="240">4 hours</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setScheduleTask(null)}
                    className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="rounded-xl bg-indigo-500 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400"
                  >
                    Save Schedule
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
