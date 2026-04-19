import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setToken } from '../lib/auth'

const apiBase = import.meta.env.VITE_API_URL ?? ''

export default function AuthPage() {
  const navigate = useNavigate()
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
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || typeof data.token !== 'string') {
        setError(data.error || 'Authentication failed.')
        return
      }
      setToken(data.token)
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-black/30">
        <h1 className="text-2xl font-semibold text-white">
          {mode === 'login' ? 'Login' : 'Create account'}
        </h1>
        <p className="mt-2 text-sm text-slate-400">JWT authentication enabled.</p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === 'register' && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              required
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            required
          />
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Sign up'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode((m) => (m === 'login' ? 'register' : 'login'))}
          className="mt-4 text-sm text-sky-300"
        >
          {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Login'}
        </button>
      </div>
    </main>
  )
}
