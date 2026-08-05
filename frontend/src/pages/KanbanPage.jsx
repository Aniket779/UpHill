import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useSocket } from '../hooks/useSocket'
import { TrashIcon } from '../components/Icons'

const apiBase = import.meta.env.VITE_API_URL ?? ''

const COLUMNS = [
  { id: 'todo', title: 'To Do', color: 'border-border bg-surface-secondary text-ink-secondary' },
  { id: 'in-progress', title: 'In Progress', color: 'border-accent-border bg-accent-soft text-accent' },
  { id: 'done', title: 'Done', color: 'border-success-border bg-success-soft text-success' },
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

  // ── Real-time socket listeners ─────────────────────────────────────────────
  useSocket('task:created', (newTask) => {
    setTasks((prev) => {
      if (prev.some((t) => t._id === newTask._id)) return prev
      return [...prev, newTask]
    })
  })

  useSocket('task:updated', (updatedTask) => {
    setTasks((prev) => {
      if (!prev.some((t) => t._id === updatedTask._id)) return prev
      return prev.map((t) => (t._id === updatedTask._id ? updatedTask : t))
    })
  })

  useSocket('task:deleted', ({ _id }) => {
    setTasks((prev) => prev.filter((t) => t._id !== _id))
  })
  // ──────────────────────────────────────────────────────────────────────────

  async function deleteTask(e, id) {
    e.stopPropagation()
    if (!window.confirm('Delete this task? This cannot be undone.')) return
    setError(null)
    const prevTasks = tasks
    setTasks((prev) => prev.filter((t) => t._id !== id))
    const res = await apiFetch(`${apiBase}/tasks/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError('Could not delete task.')
      setTasks(prevTasks)
    }
  }

  return (
    <div className="mx-auto max-w-7xl h-[calc(100vh-6rem)] flex flex-col">
      <header className="mb-6 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-tertiary">
          Global Board
        </p>
        <h1 className="mt-1.5 text-display text-ink">Kanban</h1>
        <p className="mt-2 text-sm text-ink-tertiary">
          Drag and drop tasks across stages. Syncs instantly with your Today planner.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-control border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger shrink-0">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ink-tertiary">Loading board…</p>
      ) : (
        <div className="flex-1 flex gap-5 overflow-x-auto pb-4 [&::-webkit-scrollbar]:hidden">
          {COLUMNS.map(col => {
            const colTasks = tasks.filter(t => t.status === col.id || (!t.status && col.id === (t.completed ? 'done' : 'todo')))
            return (
              <div
                key={col.id}
                className="flex-1 min-w-[300px] flex flex-col rounded-card border border-border bg-surface-secondary/50 p-3"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                <div className={`mb-3 inline-flex items-center gap-2 self-start rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${col.color}`}>
                  {col.title} <span className="opacity-60 tabular-nums">{colTasks.length}</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 [&::-webkit-scrollbar]:hidden pr-1">
                  {colTasks.map(t => (
                    <div
                      key={t._id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, t._id)}
                      className={`cursor-grab active:cursor-grabbing rounded-card border bg-surface p-3.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-popover ${
                        t.priority === 'high'
                          ? 'border-l-[3px] border-l-priority-high border-border'
                          : t.priority === 'medium'
                          ? 'border-l-[3px] border-l-priority-medium border-border'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium leading-snug ${t.completed ? 'text-ink-tertiary line-through' : 'text-ink'}`}>
                          {t.title}
                        </p>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                            t.priority === 'high' ? 'bg-priority-high-soft text-priority-high' : t.priority === 'medium' ? 'bg-priority-medium-soft text-priority-medium' : 'bg-surface-secondary text-ink-tertiary'
                          }`}>
                            {t.priority}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => deleteTask(e, t._id)}
                            className="flex h-5 w-5 items-center justify-center rounded text-ink-tertiary transition-colors hover:bg-danger-soft hover:text-danger"
                            aria-label="Delete task"
                            title="Delete task"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-tertiary font-medium">
                        {t.date && <span className="rounded bg-surface-secondary px-1.5 py-0.5">{t.date}</span>}
                        {t.category && <span className="rounded bg-surface-secondary px-1.5 py-0.5">{t.category}</span>}
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="rounded-card border border-dashed border-border-strong py-10 text-center text-sm text-ink-tertiary">
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
