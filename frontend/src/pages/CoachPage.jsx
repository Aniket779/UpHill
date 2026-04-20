import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

const apiBase = import.meta.env.VITE_API_URL ?? ''

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

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ icon, label, accent, children }) {
  return (
    <div className={`rounded-2xl border ${accent.border} ${accent.bg} p-5 backdrop-blur-sm`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent.iconBg} text-lg`}>
          {icon}
        </div>
        <h3 className={`text-xs font-bold uppercase tracking-[0.18em] ${accent.label}`}>{label}</h3>
      </div>
      {children}
    </div>
  )
}

function ContextBadges({ context }) {
  if (!context) return null
  const { taskCompletionRate, habitsAtRisk, habitsThriving, windowDays } = context
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/25 bg-sky-950/40 px-3 py-1 text-xs font-semibold text-sky-300">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-400 inline-block" />
        7-day window: {windowDays?.[0]} → {windowDays?.[windowDays.length - 1]}
      </span>
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
        taskCompletionRate >= 70
          ? 'border-emerald-500/25 bg-emerald-950/40 text-emerald-300'
          : taskCompletionRate >= 40
          ? 'border-amber-500/25 bg-amber-950/40 text-amber-300'
          : 'border-rose-500/25 bg-rose-950/40 text-rose-300'
      }`}>
        <span className={`h-1.5 w-1.5 rounded-full inline-block ${
          taskCompletionRate >= 70 ? 'bg-emerald-400' : taskCompletionRate >= 40 ? 'bg-amber-400' : 'bg-rose-400'
        }`} />
        Task completion: {taskCompletionRate}%
      </span>
      {habitsAtRisk?.length > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-950/40 px-3 py-1 text-xs font-semibold text-rose-300">
          ⚠ At-risk: {habitsAtRisk.join(', ')}
        </span>
      )}
      {habitsThriving?.length > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-300">
          🔥 Thriving: {habitsThriving.join(', ')}
        </span>
      )}
    </div>
  )
}

function FeedbackSections({ feedback, context }) {
  if (!feedback || typeof feedback !== 'object') return null

  const { pattern, actionPlan, insight } = feedback

  return (
    <article className="mb-10 space-y-4">
      {/* Context badges row */}
      <ContextBadges context={context} />

      {/* Pattern Detected */}
      <SectionCard
        icon="🔍"
        label="Pattern Detected"
        accent={{
          border: 'border-violet-500/25',
          bg: 'bg-violet-950/20',
          iconBg: 'bg-violet-950/60 ring-1 ring-violet-500/30',
          label: 'text-violet-300',
        }}
      >
        <p className="text-sm leading-relaxed text-slate-200">{pattern}</p>
      </SectionCard>

      {/* Action Plan */}
      <SectionCard
        icon="⚡"
        label="Action Plan"
        accent={{
          border: 'border-sky-500/25',
          bg: 'bg-sky-950/20',
          iconBg: 'bg-sky-950/60 ring-1 ring-sky-500/30',
          label: 'text-sky-300',
        }}
      >
        <ol className="space-y-3">
          {(Array.isArray(actionPlan) ? actionPlan : []).map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-sky-500/20 text-[10px] font-bold text-sky-300 ring-1 ring-sky-500/30">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-slate-200">{step}</p>
            </li>
          ))}
        </ol>
      </SectionCard>

      {/* Coach Insight */}
      <SectionCard
        icon="💡"
        label="Coach Insight"
        accent={{
          border: 'border-amber-500/25',
          bg: 'bg-amber-950/20',
          iconBg: 'bg-amber-950/60 ring-1 ring-amber-500/30',
          label: 'text-amber-300',
        }}
      >
        <blockquote className="border-l-2 border-amber-500/40 pl-4">
          <p className="text-sm leading-relaxed text-slate-200 italic">{insight}</p>
        </blockquote>
      </SectionCard>
    </article>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CoachPage() {
  const [feedback, setFeedback] = useState(null)
  const [context, setContext] = useState(null)
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
    queueMicrotask(() => void loadHistory())
  }, [loadHistory])

  const getFeedback = useCallback(async () => {
    setError(null)
    setFeedback(null)
    setContext(null)
    setLoading(true)
    try {
      // The backend now fetches all context itself — no need to send anything
      const userId =
        typeof localStorage !== 'undefined' ? localStorage.getItem('grindos_user_id') : null

      const res = await apiFetch(`${apiBase}/ai/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userId ? { userId } : {}),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.detail || data.error || 'Could not get feedback.')
        return
      }
      if (!data.feedback || typeof data.feedback !== 'object') {
        setError('Unexpected response format from server.')
        return
      }
      setFeedback(data.feedback)
      setContext(data.context ?? null)
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
        {/* Header */}
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300/90">
            AI Coach
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Personalized Feedback
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
            Analyzes your last 7 days of tasks, habits, and goals. Detects real patterns,
            identifies what's slipping, and delivers a targeted action plan — not generic advice.
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void getFeedback()}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-amber-900/30 transition hover:from-amber-500 hover:to-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Analyzing 7 days…
              </>
            ) : (
              <>
                <span>⚡</span>
                Analyze My Week
              </>
            )}
          </button>
        </header>

        {/* Error */}
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

        {/* Structured feedback sections */}
        {feedback && <FeedbackSections feedback={feedback} context={context} />}

        {/* Empty state */}
        {!feedback && !error && !loading && history.length === 0 && (
          <div className="mb-10 rounded-2xl border border-dashed border-slate-800 px-6 py-12 text-center">
            <p className="text-2xl mb-3">🎯</p>
            <p className="text-sm font-medium text-slate-300">Ready for a reality check?</p>
            <p className="mt-2 text-sm text-slate-500">
              Hit <span className="font-medium text-slate-400">Analyze My Week</span> and the AI
              will scan your last 7 days — tasks, habits, goals — and tell you exactly what's
              working and what isn't.
            </p>
          </div>
        )}

        {/* Past Feedback History */}
        {history.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">
              Past feedback
            </h2>
            <ul className="space-y-3">
              {history.map((item) => (
                <li
                  key={item._id}
                  className="rounded-xl border border-slate-800/90 bg-slate-900/50 p-4 shadow-md shadow-black/20"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    {formatFeedbackDate(item.createdAt)}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300 line-clamp-4 whitespace-pre-wrap">
                    {item.text}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
