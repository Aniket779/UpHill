import { useCallback, useEffect, useState, useRef } from 'react'
import { apiFetch } from '../lib/api'
import { BellIcon, CloseIcon } from './Icons'

const apiBase = import.meta.env.VITE_API_URL ?? ''

const priorityStyles = {
  high: 'border-rose-500/40 bg-rose-950/25 text-rose-50',
  medium: 'border-amber-500/35 bg-amber-950/20 text-amber-50',
  low: 'border-sky-600/30 bg-sky-950/20 text-sky-50',
}

export default function NotificationsPopover() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef(null)

  const load = useCallback(async () => {
    setFetchError(false)
    try {
      const res = await apiFetch(`${apiBase}/notifications`)
      const data = await res.json().catch(() => ([]))
      if (!res.ok || !Array.isArray(data)) {
        setNotifications([])
        setFetchError(true)
        return
      }
      setNotifications(data)
    } catch {
      setNotifications([])
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const dismiss = async (id) => {
    try {
      await apiFetch(`${apiBase}/notifications/${id}/dismiss`, { method: 'POST' });
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
    
    const interval = setInterval(() => {
      void load()
    }, 30000) // Refresh every 30s
    
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const hasNotifications = notifications.length > 0

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-700/80 bg-slate-800/80 text-slate-300 transition hover:bg-slate-700 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
        aria-label="Notifications"
      >
        <BellIcon className="h-5 w-5" />
        {hasNotifications && (
          <span className="absolute right-2.5 top-2 h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] border-2 border-slate-900" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-xl shadow-black/40 backdrop-blur-md z-50">
          <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3 bg-slate-900/40">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Notifications</h2>
            <span className="text-[9px] font-medium uppercase tracking-wider text-slate-600">
              Smart Insights
            </span>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {loading && <p className="text-sm text-slate-500 text-center py-4">Checking for updates…</p>}

            {!loading && fetchError && (
              <p className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-3 py-2.5 text-sm text-amber-100/90">
                Couldn&apos;t load notifications.
              </p>
            )}

            {!loading && !fetchError && notifications.length > 0 && (
              <ul className="space-y-3">
                {notifications.map((n) => (
                  <li
                    key={n._id}
                    className={`relative group rounded-xl border p-3 text-sm leading-snug transition hover:bg-white/5 ${priorityStyles[n.priority] || priorityStyles.low}`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <span className="font-bold text-[11px] uppercase tracking-wider opacity-80">{n.title}</span>
                      <button 
                        onClick={() => dismiss(n._id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-black/20 transition-opacity"
                        title="Dismiss"
                      >
                        <CloseIcon className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="text-xs opacity-90">{n.message}</p>
                    <span className="mt-2 block text-[9px] opacity-50 font-mono">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {!loading && !fetchError && notifications.length === 0 && (
              <div className="text-center py-8">
                <p className="text-2xl mb-2">🎉</p>
                <p className="text-sm text-slate-400">All caught up!</p>
                <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-widest">No pending notifications</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
