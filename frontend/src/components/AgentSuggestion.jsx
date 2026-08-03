import { useState } from 'react'
import { apiFetch } from '../lib/api'
import { MessageIcon } from './Icons'

const apiBase = import.meta.env.VITE_API_URL ?? ''

export default function AgentSuggestion({ onTaskUpdated }) {
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState(null)

  const analyzeDay = async () => {
    setLoading(true)
    setError(null)
    setAnalysis(null)
    try {
      const res = await apiFetch(`${apiBase}/agent/analyze-day`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localTime: new Date().toLocaleTimeString() })
      })
      if (!res.ok) throw new Error('Failed to analyze day')
      const data = await res.json()
      setAnalysis(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async () => {
    if (!analysis?.suggestedTaskId || !analysis?.suggestedAction) return

    setLoading(true)
    try {
      if (analysis.suggestedAction === 'reschedule_tomorrow') {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const dateStr = tomorrow.toISOString().split('T')[0]

        await apiFetch(`${apiBase}/tasks/${analysis.suggestedTaskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: dateStr })
        })
        if (onTaskUpdated) onTaskUpdated()
        setAnalysis(null) // dismiss after action
      } else if (analysis.suggestedAction === 'mark_done') {
        await apiFetch(`${apiBase}/tasks/${analysis.suggestedTaskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: true })
        })
        if (onTaskUpdated) onTaskUpdated()
        setAnalysis(null)
      }
    } catch (err) {
      console.error(err)
      setError('Failed to apply action')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-slate-900/40 p-4 shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400">
            <MessageIcon className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-slate-200">Agentic Insight</h2>
        </div>
        {!analysis && !loading && (
          <button 
            onClick={analyzeDay}
            className="rounded-lg bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-400 hover:bg-indigo-500/20 transition"
          >
            Analyze My Day
          </button>
        )}
      </div>

      {loading && (
        <div className="mt-4 animate-pulse space-y-2">
          <div className="h-4 w-3/4 rounded bg-slate-700/50"></div>
          <div className="h-4 w-1/2 rounded bg-slate-700/50"></div>
        </div>
      )}

      {error && <p className="mt-4 text-xs text-rose-400">{error}</p>}

      {analysis && !loading && (
        <div className="mt-4">
          <p className="text-sm text-slate-300">{analysis.suggestion}</p>
          {analysis.actionable && analysis.suggestedTaskId && (
            <div className="mt-4 flex gap-3">
              <button 
                onClick={handleAction}
                className="rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition"
              >
                {analysis.suggestedAction === 'reschedule_tomorrow' ? 'Move to Tomorrow' : 'Apply Suggestion'}
              </button>
              <button 
                onClick={() => setAnalysis(null)}
                className="rounded-lg bg-white/5 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-white/10 transition"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
