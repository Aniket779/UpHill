import { useCallback, useEffect, useState, useRef } from 'react'
import { apiFetch } from '../lib/api'
import { BellIcon, CloseIcon, CheckCircleIcon } from './Icons'
import IconButton from './ui/IconButton'

const apiBase = import.meta.env.VITE_API_URL ?? ''

const priorityStyles = {
  high: 'border-l-2 border-l-priority-high bg-priority-high-soft/60',
  medium: 'border-l-2 border-l-priority-medium bg-priority-medium-soft/60',
  low: 'border-l-2 border-l-priority-low bg-surface-secondary',
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
      <IconButton onClick={() => setIsOpen(!isOpen)} className="relative" aria-label="Notifications">
        <BellIcon className="h-[18px] w-[18px]" />
        {hasNotifications && (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" />
        )}
      </IconButton>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-card border border-border bg-surface shadow-popover z-50">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Notifications</h2>
            <span className="text-[10px] font-medium uppercase tracking-wide text-ink-tertiary">
              Smart Insights
            </span>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {loading && <p className="text-sm text-ink-tertiary text-center py-4">Checking for updates…</p>}

            {!loading && fetchError && (
              <p className="rounded-control border border-warning-border bg-warning-soft px-3 py-2.5 text-sm text-warning">
                Couldn&apos;t load notifications.
              </p>
            )}

            {!loading && !fetchError && notifications.length > 0 && (
              <ul className="space-y-2">
                {notifications.map((n) => (
                  <li
                    key={n._id}
                    className={`relative group rounded-control px-3 py-2.5 text-sm leading-snug transition-colors ${priorityStyles[n.priority] || priorityStyles.low}`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-0.5">
                      <span className="font-semibold text-[11px] uppercase tracking-wide text-ink-secondary">{n.title}</span>
                      <button
                        onClick={() => dismiss(n._id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-ink-tertiary hover:text-ink transition-opacity"
                        title="Dismiss"
                      >
                        <CloseIcon className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="text-xs text-ink-secondary">{n.message}</p>
                    <span className="mt-1.5 block text-[10px] text-ink-tertiary font-mono">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {!loading && !fetchError && notifications.length === 0 && (
              <div className="text-center py-8">
                <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-success-soft text-success">
                  <CheckCircleIcon className="h-4 w-4" />
                </div>
                <p className="text-sm text-ink-secondary">All caught up</p>
                <p className="text-[11px] text-ink-tertiary mt-0.5">No pending notifications</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
