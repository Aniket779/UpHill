import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { apiFetch } from '../lib/api'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Select from '../components/ui/Select'
import EmptyState from '../components/ui/EmptyState'

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
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await apiFetch(`${apiBase}/tasks?date=today`)
    if (!res.ok) {
      setTasks([])
      setError('Could not load tasks for focus mode.')
      return
    }
    const data = await res.json()
    const openTasks = Array.isArray(data) ? data.filter(t => !t.completed) : []
    setTasks(openTasks)

    if (openTasks.length > 0) {
      setSelectedTaskId(prev => {
        if (prev && openTasks.some(t => t._id === prev)) return prev
        const high = openTasks.find(t => t.priority === 'high')
        return high ? high._id : openTasks[0]._id
      })
    }
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
          setRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const currentTask = useMemo(
    () => tasks.find((t) => t._id === selectedTaskId) || null,
    [tasks, selectedTaskId]
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

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`)
      })
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
  }

  const radius = 130
  const stroke = 6
  const normalizedRadius = radius - stroke * 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDashoffset = circumference - (remaining / POMODORO_SECONDS) * circumference

  return (
    <div ref={containerRef} className={`transition-all duration-500 ease-in-out ${isFullscreen ? 'fixed inset-0 z-50 bg-bg flex flex-col items-center justify-center p-8' : 'mx-auto max-w-4xl'}`}>

      {!isFullscreen && (
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-tertiary">
            Deep work
          </p>
          <h1 className="mt-1.5 text-display text-ink">Zen Mode</h1>
          <p className="mt-2 text-sm text-ink-tertiary">
            Select a task, enter fullscreen, and eliminate all distractions for 25 minutes.
          </p>
        </header>
      )}

      <Card padding="p-8 lg:p-12" className={isFullscreen ? 'w-full max-w-3xl shadow-modal' : ''}>
        {loading ? (
          <p className="text-sm text-ink-tertiary text-center py-12">Loading tasks…</p>
        ) : tasks.length > 0 ? (
          <div className="flex flex-col items-center">

            <div className="w-full max-w-md mb-10">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-tertiary mb-3 text-center">
                Currently focusing on
              </label>
              <Select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                disabled={running}
                className="text-center text-base font-medium py-3.5"
              >
                {tasks.map(t => (
                  <option key={t._id} value={t._id}>
                    {t.title}
                  </option>
                ))}
              </Select>
            </div>

            <div className="relative flex items-center justify-center mb-10">
              <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
                <circle
                  stroke="currentColor"
                  className="text-surface-tertiary"
                  fill="transparent"
                  strokeWidth={stroke}
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                />
                <circle
                  stroke="currentColor"
                  className="text-accent"
                  fill="transparent"
                  strokeWidth={stroke}
                  strokeDasharray={circumference + ' ' + circumference}
                  style={{ strokeDashoffset, transition: 'stroke-dashoffset 1s linear' }}
                  strokeLinecap="round"
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-6xl font-semibold tracking-tight text-ink tabular-nums">
                  {formatClock(remaining)}
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.25em] text-ink-tertiary font-semibold">
                  {running ? 'Focusing' : remaining === 0 ? 'Done' : 'Paused'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" onClick={() => setRunning((r) => !r)} variant={running ? 'secondary' : 'primary'}>
                {running ? 'Pause Timer' : 'Start Focus'}
              </Button>

              <Button
                size="lg"
                variant="ghost"
                onClick={resetTimer}
                disabled={remaining === POMODORO_SECONDS && !running}
              >
                Reset
              </Button>

              <Button
                size="lg"
                variant="secondary"
                onClick={() => void markComplete()}
                disabled={saving || !currentTask}
                className="!border-success-border !bg-success-soft !text-success hover:!bg-success-soft/70"
              >
                {saving ? 'Saving…' : 'Mark Task Done'}
              </Button>
            </div>

          </div>
        ) : (
          <EmptyState title="No open tasks available" description="Add some from the Today page first." />
        )}

        {error && (
          <p className="mt-8 rounded-control border border-danger-border bg-danger-soft px-6 py-4 text-sm text-danger text-center">
            {error}
          </p>
        )}
      </Card>

      <button
        onClick={toggleFullScreen}
        className={`fixed bottom-8 right-8 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-ink-tertiary shadow-popover transition hover:text-ink hover:scale-105 ${isFullscreen ? 'opacity-30 hover:opacity-100' : ''}`}
        title={isFullscreen ? "Exit Zen Mode" : "Enter Zen Mode (Fullscreen)"}
      >
        {isFullscreen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        )}
      </button>

    </div>
  )
}
