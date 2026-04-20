import { useCallback, useEffect, useState, useRef } from 'react'
import { apiFetch } from '../lib/api'
import { BellIcon } from './Icons'

const apiBase = import.meta.env.VITE_API_URL ?? ''

const levelStyles = {
  alert: 'border-rose-500/40 bg-rose-950/25 text-rose-50',
  warning: 'border-amber-500/35 bg-amber-950/20 text-amber-50',
  info: 'border-sky-600/30 bg-sky-950/20 text-sky-50',
}

export default function RemindersPopover() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef(null)

  const load = useCallback(async () => {
    setFetchError(false)
    try {
      const res = await apiFetch(`${apiBase}/insights/reminders`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !Array.isArray(data.messages)) {
        setMessages([])
        setFetchError(true)
        return
      }
      setMessages(data.messages)
    } catch {
      setMessages([])
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
    
    // Auto refresh reminders periodically
    const interval = setInterval(() => {
      void load()
    }, 60000)
    
    return () => clearInterval(interval)
  }, [load])

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const hasReminders = messages.length > 0

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-700/80 bg-slate-800/80 text-slate-300 transition hover:bg-slate-700 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
        aria-label="Notifications"
      >
        <BellIcon className="h-5 w-5" />
        {hasReminders && (
          <span className="absolute right-2.5 top-2 h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-xl shadow-black/40 backdrop-blur-md z-50">
          <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3 bg-slate-900/40">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Reminders</h2>
            <span className="text-[9px] font-medium uppercase tracking-wider text-slate-600">
              Insights Rules
            </span>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {loading && <p className="text-sm text-slate-500 text-center py-4">Checking reminders…</p>}

            {!loading && fetchError && (
              <p className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-3 py-2.5 text-sm text-amber-100/90">
                Couldn&apos;t load reminders.
              </p>
            )}

            {!loading && !fetchError && messages.length > 0 && (
              <ul className="space-y-2">
                {messages.map((r) => (
                  <li
                    key={r.code + r.text.slice(0, 48)}
                    className={`rounded-xl border px-3 py-2.5 text-sm leading-snug ${levelStyles[r.level] || levelStyles.info}`}
                  >
                    {r.text}
                  </li>
                ))}
              </ul>
            )}

            {!loading && !fetchError && messages.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                You're all caught up! No active reminders.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
