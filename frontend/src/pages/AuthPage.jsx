import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { LogoMark, ClockIcon, FlameIcon, TargetIcon, SparkleIcon } from '../components/Icons'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

const apiBase = import.meta.env.VITE_API_URL ?? ''

const FEATURES = [
  { icon: ClockIcon, label: 'Daily Planner' },
  { icon: FlameIcon, label: 'Habit Streaks' },
  { icon: TargetIcon, label: 'Weekly Goals' },
  { icon: SparkleIcon, label: 'AI Coach' },
]

export default function AuthPage() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register'
      const body =
        mode === 'login'
          ? { email: email.trim(), password }
          : { name: name.trim(), email: email.trim(), password }
      const res = await fetch(`${apiBase}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.user) {
        setError(data.error || 'Authentication failed.')
        return
      }
      setUser(data.user)
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-screen bg-bg lg:grid-cols-2">
      {/* Hero panel — hidden on mobile, this is the professional "first impression" side */}
      <section className="hidden flex-col justify-center border-r border-border bg-surface px-16 py-20 lg:flex">
        <div className="max-w-lg">
          <div className="mb-8 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <LogoMark className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-ink">UpHill</span>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-tertiary">
            An AI operating system for ambitious people
          </p>

          <h1 className="mt-4 text-[2.75rem] font-semibold leading-[1.08] tracking-tight text-ink">
            Stop guessing what to work on next.
          </h1>

          <p className="mt-5 text-base leading-relaxed text-ink-secondary">
            UpHill turns your tasks, habits, and goals into one system — with{' '}
            <span className="font-semibold text-accent">an AI coach that tells you the truth
            about your week</span>, not what you want to hear.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <span
                  key={feature.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-3 py-1.5 text-xs font-medium text-ink-secondary"
                >
                  <Icon className="h-3.5 w-3.5 text-ink-tertiary" />
                  {feature.label}
                </span>
              )
            })}
          </div>
        </div>
      </section>

      {/* Form panel */}
      <section className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <LogoMark className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">UpHill</h1>
          </div>

          <div className="mb-6 text-center lg:mb-6 lg:text-left">
            <h2 className="text-xl font-semibold tracking-tight text-ink">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mt-1.5 text-sm text-ink-tertiary">
              {mode === 'login' ? 'Sign in to continue to UpHill.' : 'Start planning with UpHill.'}
            </p>
          </div>

          <div className="rounded-card border border-border bg-surface p-6 shadow-card">
            <form onSubmit={submit} className="space-y-3">
              {mode === 'register' && (
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name"
                  required
                />
              )}
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
              />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
              />
              {error && (
                <p className="rounded-control bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
              )}
              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Sign up'}
              </Button>
            </form>
          </div>

          <button
            type="button"
            onClick={() => setMode((m) => (m === 'login' ? 'register' : 'login'))}
            className="mt-5 w-full text-center text-sm text-ink-tertiary transition-colors hover:text-accent"
          >
            {mode === 'login' ? (
              <>Need an account? <span className="font-medium text-accent">Sign up</span></>
            ) : (
              <>Already have an account? <span className="font-medium text-accent">Log in</span></>
            )}
          </button>
        </div>
      </section>
    </main>
  )
}
