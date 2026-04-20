import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { UserIcon } from '../components/Icons'

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
    load()
  }, [load])

  const renderGrid = () => {
    if (!data || !data.contributions || data.contributions.length === 0) return null

    // Pad so the first cell falls on the correct weekday (0=Sun)
    const firstDate = new Date(data.contributions[0].date + 'T00:00:00') // force local parse
    const startDayOfWeek = firstDate.getDay()
    const padded = [...Array(startDayOfWeek).fill(null), ...data.contributions]
    
    // Debug: log today and yesterday's counts
    const last = data.contributions[data.contributions.length - 1]
    const prev = data.contributions[data.contributions.length - 2]
    console.log('[Profile] Today:', last, '  Yesterday:', prev)

    return (
      <div className="overflow-x-auto pb-4">
        <div
          style={{
            display: 'grid',
            gridTemplateRows: 'repeat(7, 14px)',
            gridAutoFlow: 'column',
            gap: '4px',
          }}
        >
          {padded.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} style={{ width: 14, height: 14, borderRadius: 3 }} />

            let bgColor = 'rgba(255,255,255,0.03)'
            let border = '1px solid rgba(255,255,255,0.05)'
            let boxShadow = 'none'
            if (day.count === 1) { bgColor = 'rgba(6,78,59,0.7)'; border = '1px solid rgba(6,78,59,0.5)' }
            else if (day.count >= 2 && day.count <= 3) { bgColor = '#059669'; border = '1px solid #10b981' }
            else if (day.count > 3) { bgColor = '#34d399'; border = '1px solid #6ee7b7'; boxShadow = '0 0 8px rgba(52,211,153,0.6)' }

            return (
              <div
                key={day.date}
                title={`${day.count} ${day.count === 1 ? 'activity' : 'activities'} on ${day.date}`}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  backgroundColor: bgColor,
                  border,
                  boxShadow,
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
      <header className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="h-24 w-24 rounded-full border-2 border-white/10 bg-gradient-to-br from-indigo-500/40 to-sky-500/40 flex items-center justify-center shadow-2xl backdrop-blur-md">
            <UserIcon className="h-10 w-10 text-white/80" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              User Profile
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              GrindOS Pro Member
            </p>
          </div>
        </div>
      </header>

      {error && (
        <p className="mb-8 rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading profile data…</p>
      ) : data ? (
        <div className="space-y-8">
          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-md p-6 shadow-xl">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Total Activity</h3>
              <p className="mt-2 text-4xl font-bold text-white">{data.totalActivity}</p>
              <p className="mt-1 text-xs text-slate-400">Completed tasks & habits in the last year</p>
            </div>
            <div className="rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-md p-6 shadow-xl">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400/80">Current Streak</h3>
              <p className="mt-2 text-4xl font-bold text-orange-300">{data.currentStreak} <span className="text-lg text-orange-400/50">days</span></p>
              <p className="mt-1 text-xs text-slate-400">Keep it alive!</p>
            </div>
            <div className="rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-md p-6 shadow-xl">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/80">Longest Streak</h3>
              <p className="mt-2 text-4xl font-bold text-emerald-300">{data.longestStreak} <span className="text-lg text-emerald-400/50">days</span></p>
              <p className="mt-1 text-xs text-slate-400">Your all-time personal best</p>
            </div>
          </div>

          {/* Activity Graph */}
          <div className="rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-md p-8 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                1-Year Activity Graph
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Less</span>
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-sm bg-slate-800/40 border border-white/5"></div>
                  <div className="w-3 h-3 rounded-sm bg-emerald-900/60 border border-emerald-900/50"></div>
                  <div className="w-3 h-3 rounded-sm bg-emerald-600 border border-emerald-500/50"></div>
                  <div className="w-3 h-3 rounded-sm bg-emerald-400 border border-emerald-300"></div>
                </div>
                <span>More</span>
              </div>
            </div>
            {renderGrid()}
          </div>
        </div>
      ) : null}
    </div>
  )
}
