import { useCallback, useEffect, useState } from 'react'
import { AuthContext } from './AuthContext'

const apiBase = import.meta.env.VITE_API_URL ?? ''

/**
 * Tracks the current session by asking the server (GET /auth/me), which
 * relies on the httpOnly session cookie the browser sends automatically.
 * The JWT itself is never readable from JS.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/auth/me`, { credentials: 'include' })
      setUser(res.ok ? await res.json() : null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      await refresh()
    })()
  }, [refresh])

  const logout = useCallback(async () => {
    try {
      await fetch(`${apiBase}/auth/logout`, { method: 'POST', credentials: 'include' })
    } finally {
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, setUser, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
