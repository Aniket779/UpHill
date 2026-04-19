import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'

const apiBase = import.meta.env.VITE_API_URL ?? ''
const SESSION_KEY = 'grindos_coach_chat_session_id'

export default function ChatPage() {
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY) ?? null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hydrating, setHydrating] = useState(() => !!localStorage.getItem(SESSION_KEY))
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const sid = localStorage.getItem(SESSION_KEY)
    if (!sid) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch(`${apiBase}/ai/chat?sessionId=${encodeURIComponent(sid)}`)
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.status === 404) {
          localStorage.removeItem(SESSION_KEY)
          setSessionId(null)
          setMessages([])
        } else if (res.ok && Array.isArray(data.messages)) {
          setSessionId(data.sessionId)
          setMessages(data.messages)
        }
      } catch {
        if (!cancelled) setError('Could not restore your last session.')
      } finally {
        if (!cancelled) setHydrating(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    const prevSnap = messages
    setInput('')
    setError(null)
    setLoading(true)
    setMessages([...prevSnap, { role: 'user', content: text }])

    try {
      const res = await apiFetch(`${apiBase}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId ?? undefined,
          message: text,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessages(prevSnap)
        setError(data.detail || data.error || 'Request failed.')
        return
      }
      if (data.sessionId) {
        localStorage.setItem(SESSION_KEY, data.sessionId)
        setSessionId(data.sessionId)
      }
      if (Array.isArray(data.messages)) {
        setMessages(data.messages)
      } else if (typeof data.reply === 'string') {
        setMessages((m) => [...m, { role: 'assistant', content: data.reply }])
      }
    } catch (e) {
      setMessages(prevSnap)
      setError(e instanceof Error ? e.message : 'Network error.')
    } finally {
      setLoading(false)
    }
  }

  function newChat() {
    localStorage.removeItem(SESSION_KEY)
    setSessionId(null)
    setMessages([])
    setError(null)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-950">
      <header className="shrink-0 border-b border-slate-800/90 px-4 py-5 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/90">
              Coach chat
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Accountability</h1>
            <p className="mt-1 max-w-md text-xs text-slate-500">
              Direct feedback only. The coach remembers this thread until you start over.
            </p>
          </div>
          <button
            type="button"
            onClick={newChat}
            className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            New chat
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 pb-28">
          {hydrating && (
            <p className="text-center text-sm text-slate-500">Loading conversation…</p>
          )}

          {!hydrating && messages.length === 0 && !loading && (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 px-5 py-12 text-center">
              <p className="text-sm text-slate-500">
                Open with what you&apos;re working on, where you&apos;re stuck, or what you committed
                to ship. Expect sharp questions and clear next actions.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={`${i}-${m.role}-${String(m.content).slice(0, 24)}`}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%] ${
                  m.role === 'user'
                    ? 'bg-slate-800 text-slate-100 ring-1 ring-slate-700/80'
                    : 'border border-amber-900/35 bg-gradient-to-br from-slate-900/95 to-slate-950 text-slate-200 shadow-lg shadow-black/20'
                }`}
              >
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {m.role === 'user' ? 'You' : 'Coach'}
                </p>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-500">
                Coach is thinking…
              </div>
            </div>
          )}

          {error && (
            <div
              className="rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200"
              role="alert"
            >
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-800/90 bg-slate-950/95 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-10">
        <form
          className="mx-auto flex max-w-3xl gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message your coach…"
            disabled={loading || hydrating}
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-500/15 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || hydrating || !input.trim()}
            className="shrink-0 rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
