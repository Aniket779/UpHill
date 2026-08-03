/**
 * Fetch wrapper that always sends the httpOnly session cookie.
 * Auth is cookie-based — there is no client-readable token to attach.
 */
export async function apiFetch(input, init = {}) {
  return fetch(input, { ...init, credentials: 'include' })
}
