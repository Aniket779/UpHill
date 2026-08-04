import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { SparkleIcon, TrendingUpIcon, LightbulbIcon, TargetIcon } from '../components/Icons'
import AISurface from '../components/ui/AISurface'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'

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

function SectionCard({ icon, label, children }) {
  const Icon = icon
  return (
    <Card>
      <div className="flex items-center gap-3 mb-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ai-soft text-ai">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-secondary">{label}</h3>
      </div>
      {children}
    </Card>
  )
}

function ContextBadges({ context }) {
  if (!context) return null
  const { taskCompletionRate, habitsAtRisk, habitsThriving, windowDays } = context
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-border bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
        7-day window: {windowDays?.[0]} → {windowDays?.[windowDays.length - 1]}
      </span>
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
        taskCompletionRate >= 70
          ? 'border-success-border bg-success-soft text-success'
          : taskCompletionRate >= 40
          ? 'border-warning-border bg-warning-soft text-warning'
          : 'border-danger-border bg-danger-soft text-danger'
      }`}>
        Task completion: {taskCompletionRate}%
      </span>
      {habitsAtRisk?.length > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-danger-border bg-danger-soft px-3 py-1 text-xs font-semibold text-danger">
          At-risk: {habitsAtRisk.join(', ')}
        </span>
      )}
      {habitsThriving?.length > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success-border bg-success-soft px-3 py-1 text-xs font-semibold text-success">
          Thriving: {habitsThriving.join(', ')}
        </span>
      )}
    </div>
  )
}

function FeedbackSections({ feedback, context }) {
  if (!feedback || typeof feedback !== 'object') return null

  const { pattern, actionPlan, insight } = feedback

  return (
    <article className="mb-8 space-y-4">
      <ContextBadges context={context} />

      <SectionCard icon={SparkleIcon} label="Pattern Detected">
        <p className="text-sm leading-relaxed text-ink-secondary">{pattern}</p>
      </SectionCard>

      <SectionCard icon={TrendingUpIcon} label="Action Plan">
        <ol className="space-y-3">
          {(Array.isArray(actionPlan) ? actionPlan : []).map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-soft text-[10px] font-bold text-accent">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-ink-secondary">{step}</p>
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard icon={LightbulbIcon} label="Coach Insight">
        <blockquote className="border-l-2 border-ai-border pl-4">
          <p className="text-sm leading-relaxed text-ink-secondary italic">{insight}</p>
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
        typeof localStorage !== 'undefined' ? localStorage.getItem('uphill_user_id') : null

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
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ai">
          AI Coach
        </p>
        <h1 className="mt-1.5 text-display text-ink">Personalized Feedback</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-tertiary">
          Analyzes your last 7 days of tasks, habits, and goals. Detects real patterns,
          identifies what's slipping, and delivers a targeted action plan — not generic advice.
        </p>
        <Button
          variant="ai"
          size="lg"
          disabled={loading}
          onClick={() => void getFeedback()}
          className="mt-6"
        >
          {loading ? (
            <>
              <Spinner variant="white" />
              Analyzing 7 days…
            </>
          ) : (
            <>
              <SparkleIcon className="h-4 w-4" />
              Analyze My Week
            </>
          )}
        </Button>
      </header>

      {/* Error */}
      {error && (
        <div className="mb-8 rounded-card border border-danger-border bg-danger-soft px-5 py-4 text-sm" role="alert">
          <p className="font-medium text-danger">Could not generate feedback</p>
          <p className="mt-2 text-danger/90">{error}</p>
          <p className="mt-3 text-xs text-danger/70">
            Ensure <code className="rounded bg-danger/10 px-1.5 py-0.5">GEMINI_API_KEY</code> is
            set in <code className="rounded bg-danger/10 px-1.5 py-0.5">backend/.env</code> and
            restart the API server.
          </p>
        </div>
      )}

      {/* Structured feedback sections */}
      {feedback && <FeedbackSections feedback={feedback} context={context} />}

      {/* Empty state */}
      {!feedback && !error && !loading && history.length === 0 && (
        <AISurface className="mb-8 text-center" padding="px-6 py-12">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ai text-white">
            <TargetIcon className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-ink">Ready for a reality check?</p>
          <p className="mt-2 text-sm text-ink-tertiary">
            Hit <span className="font-medium text-ink-secondary">Analyze My Week</span> and the AI
            will scan your last 7 days — tasks, habits, goals — and tell you exactly what's
            working and what isn't.
          </p>
        </AISurface>
      )}

      {/* Past Feedback History */}
      {history.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-tertiary">
            Past feedback
          </h2>
          <ul className="space-y-2.5">
            {history.map((item) => (
              <li key={item._id}>
                <Card padding="p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">
                    {formatFeedbackDate(item.createdAt)}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary line-clamp-4 whitespace-pre-wrap">
                    {item.text}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
