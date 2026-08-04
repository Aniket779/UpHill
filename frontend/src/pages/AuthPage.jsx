import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { LogoMark } from '../components/Icons'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

const apiBase = import.meta.env.VITE_API_URL ?? ''

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
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <LogoMark className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
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
    </main>
  )
}
