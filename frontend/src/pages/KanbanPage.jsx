import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

const apiBase = import.meta.env.VITE_API_URL ?? ''

const COLUMNS = [
  { id: 'todo', title: 'To Do', color: 'border-slate-700/50 bg-slate-900/40 text-slate-400' },
  { id: 'in-progress', title: 'In Progress', color: 'border-sky-500/30 bg-sky-950/30 text-sky-400' },
  { id: 'done', title: 'Done', color: 'border-emerald-500/30 bg-emerald-950/30 text-emerald-400' }
]

export default function KanbanPage() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [draggedId, setDraggedId] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await apiFetch(`${apiBase}/tasks/board`)
    if (!res.ok) {
      setError('Could not load board tasks.')
      return
    }
    const data = await res.json()
    setTasks(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      await load()
      if (!cancelled) setLoading(false)
    }
    fetchData()
    return () => { cancelled = true }
  }, [load])

  const handleDragStart = (e, taskId) => {
    setDraggedId(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = async (e, columnId) => {
    e.preventDefault()
    if (!draggedId) return
    const task = tasks.find(t => t._id === draggedId)
    if (!task || task.status === columnId) {
      setDraggedId(null)
      return
    }

    // Optimistic update
    setTasks(prev => prev.map(t => t._id === draggedId ? { ...t, status: columnId, completed: columnId === 'done' } : t))
    setDraggedId(null)

    try {
      const res = await apiFetch(`${apiBase}/tasks/${draggedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: columnId }),
      })
      if (!res.ok) {
        throw new Error('Failed to update status')
      }
    } catch (err) {
      setError(err.message)
      await load()
    }
  }

  return (
    <div className="mx-auto max-w-7xl h-[calc(100vh-6rem)] flex flex-col">
      <header className="mb-8 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-400/90">
          Global Board
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Kanban
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Drag and drop tasks across stages. Syncs instantly with your Today planner.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200 shrink-0">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading board…</p>
      ) : (
        <div className="flex-1 flex gap-6 overflow-x-auto pb-4 [&::-webkit-scrollbar]:hidden">
          {COLUMNS.map(col => {
            const colTasks = tasks.filter(t => t.status === col.id || (!t.status && col.id === (t.completed ? 'done' : 'todo')))
            return (
              <div 
                key={col.id} 
                className="flex-1 min-w-[320px] flex flex-col rounded-3xl border border-white/5 bg-white/[0.01] backdrop-blur-md p-4"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                <div className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${col.color}`}>
                  {col.title} <span className="opacity-60">{colTasks.length}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3 [&::-webkit-scrollbar]:hidden pr-1">
                  {colTasks.map(t => (
                    <div
                      key={t._id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, t._id)}
                      className={`cursor-grab active:cursor-grabbing rounded-2xl border p-4 shadow-lg transition hover:-translate-y-1 ${
                        t.priority === 'high' 
                          ? 'border-rose-500/30 bg-rose-950/20 shadow-[inset_2px_0_0_0_rgba(244,63,94,0.6)]'
                          : t.priority === 'medium'
                          ? 'border-amber-500/20 bg-amber-950/10 shadow-[inset_2px_0_0_0_rgba(245,158,11,0.5)]'
                          : 'border-white/5 bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium leading-snug ${t.completed ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                          {t.title}
                        </p>
                        <span className={`shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                          t.priority === 'high' ? 'text-rose-400' : t.priority === 'medium' ? 'text-amber-400' : 'text-slate-500'
                        }`}>
                          {t.priority}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                        {t.date && <span className="rounded-md border border-white/5 bg-slate-900/50 px-2 py-1">{t.date}</span>}
                        {t.category && <span className="rounded-md border border-white/5 bg-slate-900/50 px-2 py-1">{t.category}</span>}
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/5 py-10 text-center text-sm text-slate-600">
                      Drop tasks here
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
