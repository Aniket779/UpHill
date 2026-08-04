import { useState } from 'react'
import { apiFetch } from '../lib/api'
import { SparkleIcon } from './Icons'
import AISurface from './ui/AISurface'
import Button from './ui/Button'
import Spinner from './ui/Spinner'

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
    <AISurface padding="p-5" className="mb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ai text-white">
            <SparkleIcon className="h-3.5 w-3.5" />
          </div>
          <h2 className="text-sm font-semibold text-ink">Agentic Insight</h2>
        </div>
        {!analysis && !loading && (
          <Button variant="ai" size="sm" onClick={analyzeDay}>
            Analyze My Day
          </Button>
        )}
      </div>

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-ink-tertiary">
          <Spinner />
          Thinking…
        </div>
      )}

      {error && <p className="mt-4 text-xs text-danger">{error}</p>}

      {analysis && !loading && (
        <div className="mt-4">
          <p className="text-sm leading-relaxed text-ink-secondary">{analysis.suggestion}</p>
          {analysis.actionable && analysis.suggestedTaskId && (
            <div className="mt-4 flex gap-2">
              <Button variant="ai" size="sm" onClick={handleAction}>
                {analysis.suggestedAction === 'reschedule_tomorrow' ? 'Move to Tomorrow' : 'Apply Suggestion'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAnalysis(null)}>
                Dismiss
              </Button>
            </div>
          )}
        </div>
      )}
    </AISurface>
  )
}
