import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'

const apiBase = import.meta.env.VITE_API_URL ?? ''
const POMODORO_SECONDS = 25 * 60

function formatClock(sec) {
  const s = Math.max(0, sec)
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export default function FocusPage() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [remaining, setRemaining] = useState(POMODORO_SECONDS)
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const res = await apiFetch(`${apiBase}/tasks?date=today`)
    if (!res.ok) {
      setTasks([])
      setError('Could not load tasks for focus mode.')
      return
    }
    const data = await res.json()
    setTasks(Array.isArray(data) ? data : [])
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
    if (!running) return undefined
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running])

  const currentTask = useMemo(
    () => tasks.find((t) => !t.completed) || null,
    [tasks]
  )

  async function markComplete() {
    if (!currentTask) return
    setSaving(true)
    setError(null)
    try {
      const res = await apiFetch(`${apiBase}/tasks/${currentTask._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      })
      if (!res.ok) {
        setError('Could not mark task complete.')
        return
      }
      await load()
      setRemaining(POMODORO_SECONDS)
      setRunning(false)
    } finally {
      setSaving(false)
    }
  }

  function resetTimer() {
    setRunning(false)
    setRemaining(POMODORO_SECONDS)
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 border-b border-slate-800/80 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300/90">
            Deep work
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Focus mode
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            One task at a time. 25-minute pomodoro. Finish the current item before switching context.
          </p>
        </header>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/45 p-6 shadow-xl shadow-black/25">
          {loading ? (
            <p className="text-sm text-slate-500">Loading tasks…</p>
          ) : currentTask ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Current task
              </p>
              <p className="mt-3 text-xl font-semibold leading-snug text-white">{currentTask.title}</p>
              <p className="mt-2 text-xs text-slate-500">
                Priority: <span className="text-slate-300">{currentTask.priority}</span> · Category:{' '}
                <span className="text-slate-300">{currentTask.category || 'general'}</span>
              </p>

              <div className="mt-8 rounded-xl border border-fuchsia-900/30 bg-fuchsia-950/10 p-6 text-center">
                <p className="text-xs uppercase tracking-[0.16em] text-fuchsia-200/80">Pomodoro</p>
                <p className="mt-2 text-5xl font-bold tabular-nums text-white">{formatClock(remaining)}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRunning((r) => !r)}
                    className="rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-500"
                  >
                    {running ? 'Pause' : 'Start'}
                  </button>
                  <button
                    type="button"
                    onClick={resetTimer}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-600"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => void markComplete()}
                    disabled={saving}
                    className="rounded-lg border border-emerald-700/40 bg-emerald-950/40 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-900/50 disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Mark complete'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800 py-14 text-center">
              <p className="text-sm text-slate-500">No open tasks for today. Add one from Today page.</p>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
