import { useCallback, useEffect, useMemo, useState } from 'react'
import { todayLocalString } from '../utils/date'
import RemindersBanner from '../components/RemindersBanner'
import { apiFetch } from '../lib/api'

const apiBase = import.meta.env.VITE_API_URL ?? ''

function todayLog(habit) {
  const t = todayLocalString()
  return habit.logs?.find((l) => l.date === t)
}

export default function HabitsPage() {
  const [habits, setHabits] = useState([])
  const [name, setName] = useState('')
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

  async function addHabit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setError(null)
    const res = await apiFetch(`${apiBase}/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    if (!res.ok) {
      setError('Could not create habit.')
      return
    }
    setName('')
    await load()
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

  const remindersReloadKey = useMemo(
    () =>
      habits
        .map((h) => {
          const log = todayLog(h)
          return `${h._id}:${log?.status ?? 'none'}`
        })
        .join('|'),
    [habits]
  )

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-white">Habits</h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-400">
            Build streaks by logging each habit once per day. Today&apos;s status updates instantly.
          </p>
        </header>

        <RemindersBanner topics={['habits']} reloadKey={remindersReloadKey} page="habits" />

        <form
          onSubmit={addHabit}
          className="mb-8 flex flex-col gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 shadow-xl shadow-black/25 backdrop-blur-sm sm:flex-row sm:items-center"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New habit name"
            className="min-w-0 flex-1 rounded-xl border border-slate-700/80 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 active:bg-emerald-700"
          >
            Add habit
          </button>
        </form>

        {error && (
          <p
            className="mb-6 rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-center text-sm text-slate-500">Loading habits…</p>
        ) : habits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center">
            <p className="text-sm text-slate-500">No habits yet. Add your first one above.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {habits.map((h) => {
              const log = todayLog(h)
              const doneToday = log?.status === 'done'
              return (
                <li
                  key={h._id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/40 px-5 py-4 backdrop-blur-sm"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 truncate font-medium text-white">
                      <span className="truncate">{h.name}</span>
                      <span
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-orange-500/30 bg-orange-950/40 px-2 py-0.5 text-xs font-semibold tabular-nums text-orange-100"
                        title="Current streak (consecutive done days)"
                      >
                        <span aria-hidden>🔥</span>
                        {h.streak ?? 0}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {doneToday ? (
                        <span className="text-emerald-400/90">Done today</span>
                      ) : log?.status === 'missed' ? (
                        <span className="text-amber-400/90">Missed today</span>
                      ) : (
                        'Not logged today'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={doneToday || savingId === h._id}
                    onClick={() => markDone(h._id)}
                    className="shrink-0 rounded-xl border border-emerald-700/40 bg-emerald-950/40 px-4 py-2.5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-900/50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingId === h._id ? '…' : doneToday ? 'Done' : 'Mark done'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
