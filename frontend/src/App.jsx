import { useCallback, useEffect, useState } from 'react'

const apiBase = import.meta.env.VITE_API_URL ?? ''

function todayLocalString() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayLog(habit) {
  const t = todayLocalString()
  return habit.logs?.find((l) => l.date === t)
}

export default function App() {
  const [habits, setHabits] = useState([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await fetch(`${apiBase}/habits`)
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
    const res = await fetch(`${apiBase}/habits`, {
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
      const res = await fetch(`${apiBase}/habits/${id}/log`, {
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
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-lg">
        <header className="mb-10 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/90">
            GrindOS
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Habits</h1>
          <p className="mt-2 text-sm text-slate-400">Add a habit and mark it done for today.</p>
        </header>

        <form
          onSubmit={addHabit}
          className="mb-8 flex gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 shadow-lg shadow-black/20"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New habit name"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 active:bg-emerald-700"
          >
            Add
          </button>
        </form>

        {error && (
          <p
            className="mb-6 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-center text-sm text-red-200"
            role="alert"
          >
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-center text-sm text-slate-500">Loading…</p>
        ) : habits.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-800 py-12 text-center text-sm text-slate-500">
            No habits yet. Add one above.
          </p>
        ) : (
          <ul className="space-y-3">
            {habits.map((h) => {
              const log = todayLog(h)
              const doneToday = log?.status === 'done'
              return (
                <li
                  key={h._id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{h.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
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
                    className="shrink-0 rounded-lg border border-emerald-700/50 bg-emerald-950/50 px-3 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingId === h._id ? '…' : doneToday ? 'Done' : 'Mark done'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
