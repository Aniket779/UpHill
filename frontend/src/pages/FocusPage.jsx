import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { apiFetch } from '../lib/api'

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

  const radius = 140
  const stroke = 8
  const normalizedRadius = radius - stroke * 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDashoffset = circumference - (remaining / POMODORO_SECONDS) * circumference

  return (
    <div ref={containerRef} className={`transition-all duration-500 ease-in-out ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-8' : 'mx-auto max-w-4xl'}`}>
      
      {!isFullscreen && (
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-400/90">
            Deep work
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Zen Mode
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Select a task, enter fullscreen, and eliminate all distractions for 25 minutes.
          </p>
        </header>
      )}

      <div className={`rounded-3xl border border-white/5 bg-white/[0.02] shadow-2xl backdrop-blur-3xl p-8 lg:p-12 ${isFullscreen ? 'w-full max-w-3xl' : ''}`}>
        {loading ? (
          <p className="text-sm text-slate-500 text-center py-12">Loading tasks…</p>
        ) : tasks.length > 0 ? (
          <div className="flex flex-col items-center">
            
            <div className="w-full max-w-md mb-12">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 mb-3 text-center">
                Currently focusing on
              </label>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                disabled={running}
                className="w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 text-center text-lg font-medium text-white shadow-inner outline-none transition focus:border-fuchsia-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {tasks.map(t => (
                  <option key={t._id} value={t._id} className="bg-slate-900 text-base">
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex items-center justify-center mb-12">
              <svg
                height={radius * 2}
                width={radius * 2}
                className="transform -rotate-90"
              >
                <circle
                  stroke="rgba(255, 255, 255, 0.05)"
                  fill="transparent"
                  strokeWidth={stroke}
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                />
                <circle
                  stroke="url(#gradient)"
                  fill="transparent"
                  strokeWidth={stroke}
                  strokeDasharray={circumference + ' ' + circumference}
                  style={{ strokeDashoffset, transition: 'stroke-dashoffset 1s linear' }}
                  strokeLinecap="round"
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#d946ef" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-6xl font-bold tracking-tighter text-white tabular-nums drop-shadow-[0_0_15px_rgba(217,70,239,0.5)]">
                  {formatClock(remaining)}
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-fuchsia-300/60 font-semibold">
                  {running ? 'Focusing' : remaining === 0 ? 'Done' : 'Paused'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setRunning((r) => !r)}
                className={`rounded-2xl px-8 py-4 text-sm font-bold uppercase tracking-widest text-white transition shadow-lg ${
                  running 
                    ? 'bg-white/10 hover:bg-white/20' 
                    : 'bg-fuchsia-500 hover:bg-fuchsia-400 shadow-fuchsia-500/30'
                }`}
              >
                {running ? 'Pause Timer' : 'Start Focus'}
              </button>
              
              <button
                type="button"
                onClick={resetTimer}
                disabled={remaining === POMODORO_SECONDS && !running}
                className="rounded-2xl border border-white/10 bg-transparent px-6 py-4 text-sm font-bold uppercase tracking-widest text-slate-300 transition hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Reset
              </button>

              <button
                type="button"
                onClick={() => void markComplete()}
                disabled={saving || !currentTask}
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-4 text-sm font-bold uppercase tracking-widest text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Mark Task Done'}
              </button>
            </div>

          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 py-20 text-center">
            <p className="text-slate-400">No open tasks available. Add some from the Today page first.</p>
          </div>
        )}
        
        {error && (
          <p className="mt-8 rounded-xl border border-red-900/40 bg-red-950/30 px-6 py-4 text-sm text-red-200 text-center">
            {error}
          </p>
        )}
      </div>

      <button
        onClick={toggleFullScreen}
        className={`fixed bottom-8 right-8 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-400 backdrop-blur-md transition hover:bg-white/10 hover:text-white hover:scale-110 shadow-xl ${isFullscreen ? 'opacity-20 hover:opacity-100' : ''}`}
        title={isFullscreen ? "Exit Zen Mode" : "Enter Zen Mode (Fullscreen)"}
      >
        {isFullscreen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        )}
      </button>

    </div>
  )
}
