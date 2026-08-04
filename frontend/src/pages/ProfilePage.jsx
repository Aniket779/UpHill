import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { UserIcon } from '../components/Icons'
import Card from '../components/ui/Card'

const apiBase = import.meta.env.VITE_API_URL ?? ''

export default function ProfilePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await apiFetch(`${apiBase}/analytics/contributions`)
      if (!res.ok) throw new Error('Could not load profile data.')
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      await load()
    })()
  }, [load])

  const renderGrid = () => {
    if (!data || !data.contributions || data.contributions.length === 0) return null

    // Pad so the first cell falls on the correct weekday (0=Sun)
    const firstDate = new Date(data.contributions[0].date + 'T00:00:00') // force local parse
    const startDayOfWeek = firstDate.getDay()
    const padded = [...Array(startDayOfWeek).fill(null), ...data.contributions]

    return (
      <div className="overflow-x-auto pb-2">
        <div
          style={{
            display: 'grid',
            gridTemplateRows: 'repeat(7, 12px)',
            gridAutoFlow: 'column',
            gap: '3px',
          }}
        >
          {padded.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} style={{ width: 12, height: 12, borderRadius: 3 }} />

            let bgColor = '#ECECEE'
            let border = '1px solid #E4E4E7'
            if (day.count === 1) { bgColor = '#BBF7D0'; border = '1px solid #86EFAC' }
            else if (day.count >= 2 && day.count <= 3) { bgColor = '#4ADE80'; border = '1px solid #22C55E' }
            else if (day.count > 3) { bgColor = '#16A34A'; border = '1px solid #15803D' }

            return (
              <div
                key={day.date}
                title={`${day.count} ${day.count === 1 ? 'activity' : 'activities'} on ${day.date}`}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: bgColor,
                  border,
                  cursor: 'crosshair',
                  transition: 'transform 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.4)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
              />
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-accent-soft">
            <UserIcon className="h-8 w-8 text-accent" />
          </div>
          <div>
            <h1 className="text-display text-ink">User Profile</h1>
            <p className="mt-1.5 text-sm text-ink-tertiary">UpHill Pro Member</p>
          </div>
        </div>
      </header>

      {error && (
        <p className="mb-8 rounded-control border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ink-tertiary">Loading profile data…</p>
      ) : data ? (
        <div className="space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Card>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary">Total Activity</h3>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-ink">{data.totalActivity}</p>
              <p className="mt-1 text-xs text-ink-tertiary">Completed tasks &amp; habits in the last year</p>
            </Card>
            <Card>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-warning">Current Streak</h3>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-warning">{data.currentStreak} <span className="text-base font-normal text-ink-tertiary">days</span></p>
              <p className="mt-1 text-xs text-ink-tertiary">Keep it alive!</p>
            </Card>
            <Card>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-success">Longest Streak</h3>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-success">{data.longestStreak} <span className="text-base font-normal text-ink-tertiary">days</span></p>
              <p className="mt-1 text-xs text-ink-tertiary">Your all-time personal best</p>
            </Card>
          </div>

          {/* Activity Graph */}
          <Card padding="p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">
                1-Year Activity Graph
              </h2>
              <div className="flex items-center gap-2 text-xs text-ink-tertiary">
                <span>Less</span>
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-sm bg-surface-tertiary border border-border" />
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#BBF7D0', border: '1px solid #86EFAC' }} />
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#4ADE80', border: '1px solid #22C55E' }} />
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#16A34A', border: '1px solid #15803D' }} />
                </div>
                <span>More</span>
              </div>
            </div>
            {renderGrid()}
          </Card>
        </div>
      ) : null}
    </div>
  )
}
