import { useCallback, useEffect, useState } from 'react'
import { formatTodayHeading, todayLocalString } from '../utils/date'

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
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [loading, setLoading] = useState(true)
  const [patchingId, setPatchingId] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await fetch(`${apiBase}/tasks?date=today`)
    if (!res.ok) {
      setError('Could not load today’s tasks.')
      setTasks([])
      return
    }
    const data = await res.json()
    setTasks(data)
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

  async function addTask(e) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setError(null)
    const res = await fetch(`${apiBase}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: trimmed,
        priority,
        date: todayLocalString(),
      }),
    })
    if (!res.ok) {
      setError('Could not create task.')
      return
    }
    setTitle('')
    setPriority('medium')
    await load()
  }

  async function setCompleted(id, completed) {
    setPatchingId(id)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/tasks/${id}`, {
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

  const open = tasks.filter((t) => !t.completed)
  const done = tasks.filter((t) => t.completed)
  const highOpen = open.filter((t) => t.priority === 'high').length

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-col gap-6 border-b border-slate-800/80 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400/90">
              Today planner
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {formatTodayHeading()}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
              Plan the day in one place. High-priority items stay visually loud so nothing critical
              slips past.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-auto lg:min-w-[280px]">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 px-4 py-3">
              <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Open</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">{open.length}</dd>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 px-4 py-3">
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

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/35 p-5 shadow-xl shadow-black/20 backdrop-blur-md">
              <h2 className="text-sm font-semibold text-white">Add task</h2>
              <form onSubmit={addTask} className="mt-4 space-y-4">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs to happen today?"
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/15"
                />
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
                    className="rounded-xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 active:bg-sky-700"
                  >
                    Add to today
                  </button>
                </div>
              </form>
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
                            className={`flex items-start gap-4 rounded-2xl border px-4 py-4 backdrop-blur-sm transition ${s.row}`}
                          >
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
                              </div>
                              <p className="mt-2 text-sm font-medium leading-snug text-white">
                                {t.title}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={patchingId === t._id}
                              onClick={() => setCompleted(t._id, true)}
                              className="shrink-0 rounded-lg border border-sky-700/40 bg-sky-950/40 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-900/50 disabled:opacity-50"
                            >
                              {patchingId === t._id ? '…' : 'Complete'}
                            </button>
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

          <aside className="hidden rounded-2xl border border-slate-800/60 bg-gradient-to-b from-slate-900/80 to-slate-950/90 p-6 lg:block">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Focus</h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Tackle <span className="text-rose-200/90">high</span> items before they accumulate.
              Use medium for scheduled work and low for nice-to-haves.
            </p>
            <div className="mt-6 space-y-3 border-t border-slate-800/80 pt-6 text-xs text-slate-500">
              <p>
                <span className="font-semibold text-slate-400">Keyboard:</span> add tasks from the
                main field, then use Complete to clear mental debt fast.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
