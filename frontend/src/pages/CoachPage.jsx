import { useCallback, useEffect, useState } from 'react'
import { todayLocalString } from '../utils/date'
import { apiFetch } from '../lib/api'

const apiBase = import.meta.env.VITE_API_URL ?? ''

function summarizeHabits(habits) {
  return habits.map((h) => ({
    name: h.name,
    createdAt: h.createdAt,
    logs: Array.isArray(h.logs) ? h.logs.slice(-21) : [],
  }))
}

async function fetchJson(url) {
  const res = await apiFetch(url)
  if (!res.ok) throw new Error(`Request failed: ${url}`)
  return res.json()
}

function formatFeedbackDate(iso) {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return String(iso)
  }
}

export default function CoachPage() {
  const [feedback, setFeedback] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const loadHistory = useCallback(async () => {
    try {
      const res = await apiFetch(`${apiBase}/ai/feedback-history`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !Array.isArray(data.items)) {
        setHistory([])
        return
      }
      setHistory(data.items)
    } catch {
      setHistory([])
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void loadHistory()
    })
  }, [loadHistory])

  const getFeedback = useCallback(async () => {
    setError(null)
    setFeedback(null)
    setLoading(true)
    try {
      const [habits, tasks, weeklyGoals] = await Promise.all([
        fetchJson(`${apiBase}/habits`),
        fetchJson(`${apiBase}/tasks?date=today`),
        fetchJson(`${apiBase}/goals`),
      ])

      const tasksCompleted = tasks
        .filter((t) => t.completed)
        .map((t) => ({ title: t.title, priority: t.priority }))
      const missedTasks = tasks
        .filter((t) => !t.completed)
        .map((t) => ({ title: t.title, priority: t.priority }))

      const userId =
        typeof localStorage !== 'undefined' ? localStorage.getItem('grindos_user_id') : null

      const res = await apiFetch(`${apiBase}/ai/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asOfDate: todayLocalString(),
          habits: summarizeHabits(habits),
          tasksCompleted,
          missedTasks,
          weeklyGoals: weeklyGoals.map((g) => ({
            title: g.title,
            progress: g.progress,
            weekStartDate: g.weekStartDate,
          })),
          ...(userId ? { userId } : {}),
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.detail || data.error || 'Could not get feedback.')
        return
      }
      if (typeof data.feedback !== 'string') {
        setError('Unexpected response from server.')
        return
      }
      setFeedback(data.feedback)
      await loadHistory()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }, [loadHistory])

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300/90">
            Coach
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            AI feedback
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
            Pulls your habits (recent logs), today&apos;s tasks (done vs open), and this week&apos;s
            goals. The model is prompted to behave like a disciplined coach: direct, pattern-aware,
            and actionable.
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void getFeedback()}
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-amber-900/30 transition hover:from-amber-500 hover:to-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Getting feedback…' : 'Get Feedback'}
          </button>
        </header>

        {error && (
          <div
            className="mb-8 rounded-2xl border border-red-900/45 bg-red-950/35 px-5 py-4 text-sm text-red-100"
            role="alert"
          >
            <p className="font-medium text-red-200">Could not generate feedback</p>
            <p className="mt-2 text-red-100/90">{error}</p>
            <p className="mt-3 text-xs text-red-200/70">
              Ensure <code className="rounded bg-red-950/80 px-1.5 py-0.5">GEMINI_API_KEY</code> is
              set in <code className="rounded bg-red-950/80 px-1.5 py-0.5">backend/.env</code> and
              restart the API server.
            </p>
          </div>
        )}

        {feedback && (
          <article className="mb-10 rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950/95 p-6 shadow-2xl shadow-black/40 ring-1 ring-white/5 backdrop-blur-md sm:p-8">
            <div className="mb-5 flex items-center gap-3 border-b border-slate-800/90 pb-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-lg font-bold text-amber-200 ring-1 ring-amber-500/25">
                C
              </span>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                  Coach note
                </h2>
                <p className="text-xs text-slate-500">Based on your current data snapshot</p>
              </div>
            </div>
            <div className="max-w-none text-sm leading-relaxed text-slate-200 sm:text-[15px]">
              {feedback.split(/\n\n+/).map((block, i) => (
                <p key={i} className="mb-4 whitespace-pre-wrap last:mb-0">
                  {block.trim()}
                </p>
              ))}
            </div>
          </article>
        )}

        <section className="mb-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">
            Past feedback
          </h2>
          {history.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
              Saved feedback runs will appear here (last 10).
            </p>
          ) : (
            <ul className="space-y-3">
              {history.map((item) => (
                <li
                  key={item._id}
                  className="rounded-xl border border-slate-800/90 bg-slate-900/50 p-4 shadow-md shadow-black/20"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    {formatFeedbackDate(item.createdAt)}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-200 line-clamp-6">
                    {item.text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!feedback && !error && !loading && history.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-800 px-4 py-10 text-center text-sm text-slate-500">
            When you&apos;re ready, tap <span className="font-medium text-slate-400">Get Feedback</span>{' '}
            for a blunt, useful read on how you&apos;re executing.
          </p>
        )}
      </div>
    </div>
  )
}
