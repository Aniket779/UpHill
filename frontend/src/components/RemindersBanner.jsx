import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

const apiBase = import.meta.env.VITE_API_URL ?? ''

const levelStyles = {
  alert: 'border-rose-500/40 bg-rose-950/25 text-rose-50',
  warning: 'border-amber-500/35 bg-amber-950/20 text-amber-50',
  info: 'border-sky-600/30 bg-sky-950/20 text-sky-50',
}

/**
 * @param {{ topics?: 'all' | ('tasks'|'habits')[]; reloadKey?: string | number; page?: 'today' | 'habits' }} props
 */
export default function RemindersBanner({ topics = 'all', reloadKey = 0, page = 'today' }) {
  const [messages, setMessages] = useState([])
  const [emptyHint, setEmptyHint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  const load = useCallback(async () => {
    setFetchError(false)
    try {
      const res = await apiFetch(`${apiBase}/insights/reminders`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !Array.isArray(data.messages)) {
        setMessages([])
        setEmptyHint(null)
        setFetchError(true)
        return
      }
      setMessages(data.messages)
      setEmptyHint(typeof data.emptyHint === 'string' ? data.emptyHint : null)
    } catch {
      setMessages([])
      setEmptyHint(null)
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load, reloadKey])

  const visible =
    topics === 'all'
      ? messages
      : messages.filter((r) => topics.includes(r.topic))

  const showTopicEmpty =
    !loading &&
    !fetchError &&
    topics !== 'all' &&
    visible.length === 0 &&
    messages.length > 0

  const showClearHint =
    !loading &&
    !fetchError &&
    visible.length === 0 &&
    emptyHint &&
    (topics === 'all' || messages.length === 0) &&
    !showTopicEmpty

  return (
    <section
      className="mb-6 rounded-2xl border border-slate-800/90 bg-slate-900/40 p-4 shadow-inner shadow-black/20"
      aria-label="Reminders"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Reminders</h2>
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-600">
          Insights rules · no push yet
        </span>
      </div>

      {loading && <p className="mt-3 text-sm text-slate-500">Checking reminders…</p>}

      {!loading && fetchError && (
        <p className="mt-3 rounded-xl border border-amber-900/40 bg-amber-950/20 px-3 py-2.5 text-sm text-amber-100/90">
          Couldn&apos;t load reminders. Start the backend (port 5000) and ensure the dev proxy
          includes <code className="rounded bg-slate-950 px-1 font-mono text-xs">/insights</code>.
        </p>
      )}

      {!loading && !fetchError && visible.length > 0 && (
        <ul className="mt-3 space-y-2">
          {visible.map((r) => (
            <li
              key={r.code + r.text.slice(0, 48)}
              className={`rounded-xl border px-3 py-2.5 text-sm leading-snug ${levelStyles[r.level] || levelStyles.info}`}
            >
              {r.text}
            </li>
          ))}
        </ul>
      )}

      {showClearHint && (
        <div className="mt-3 rounded-xl border border-emerald-900/30 bg-emerald-950/15 px-3 py-3 text-sm leading-relaxed text-emerald-100/90">
          {emptyHint}
        </div>
      )}

      {showTopicEmpty && (
        <p className="mt-3 text-sm text-slate-500">
          {page === 'habits'
            ? 'No habit-related nudges from the current rules. Check Today for task reminders.'
            : 'No matching reminders for this view.'}
        </p>
      )}

      {!loading &&
        !fetchError &&
        visible.length === 0 &&
        messages.length === 0 &&
        !emptyHint &&
        topics !== 'all' && (
          <p className="mt-3 text-sm text-slate-500">
            No reminders yet — add tasks or habits to get insight nudges.
          </p>
        )}
    </section>
  )
}
