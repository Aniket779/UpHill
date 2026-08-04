import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import { SparkleIcon } from '../components/Icons'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

const apiBase = import.meta.env.VITE_API_URL ?? ''
const SESSION_KEY = 'uphill_coach_chat_session_id'

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
    <div className="flex min-h-0 flex-1 flex-col -m-4 lg:-m-8">
      <header className="shrink-0 border-b border-border bg-surface px-4 py-4 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ai text-white">
              <SparkleIcon className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-ink">Coach chat</h1>
              <p className="text-xs text-ink-tertiary">Direct feedback only, remembers this thread.</p>
            </div>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={newChat} className="shrink-0">
            New chat
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-bg px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 pb-28">
          {hydrating && (
            <p className="text-center text-sm text-ink-tertiary">Loading conversation…</p>
          )}

          {!hydrating && messages.length === 0 && !loading && (
            <div className="rounded-card border border-dashed border-border-strong bg-surface px-5 py-12 text-center">
              <p className="text-sm text-ink-tertiary">
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
                className={`max-w-[85%] rounded-card px-4 py-3 text-sm leading-relaxed sm:max-w-[75%] ${
                  m.role === 'user'
                    ? 'bg-accent text-white'
                    : 'ai-ring bg-surface text-ink-secondary shadow-card'
                }`}
              >
                <p className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${m.role === 'user' ? 'text-white/70' : 'text-ink-tertiary'}`}>
                  {m.role === 'user' ? 'You' : 'Coach'}
                </p>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-card border border-border bg-surface px-4 py-3 text-sm text-ink-tertiary">
                Coach is thinking…
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-control border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-surface px-4 py-4 sm:px-6 lg:px-10">
        <form
          className="mx-auto flex max-w-3xl gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message your coach…"
            disabled={loading || hydrating}
            className="min-w-0 flex-1"
          />
          <Button
            type="submit"
            variant="ai"
            disabled={loading || hydrating || !input.trim()}
            className="shrink-0"
          >
            Send
          </Button>
        </form>
      </div>
    </div>
  )
}
