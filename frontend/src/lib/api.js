import { getToken } from './auth'

export async function apiFetch(input, init = {}) {
  const headers = new Headers(init.headers || {})
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}
