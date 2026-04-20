import { io } from 'socket.io-client'
import { getToken } from './auth'

const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/+$/, '')
  : 'http://localhost:5000'

let socket = null

/**
 * Returns the shared socket instance, creating and connecting it on first call.
 * The JWT token is sent in the handshake auth payload so the backend can verify it.
 */
export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: { token: getToken() },
      transports: ['websocket', 'polling'],
    })
  }

  if (!socket.connected) {
    // Refresh the token in case it changed since the socket was created
    socket.auth = { token: getToken() }
    socket.connect()
  }

  return socket
}

/**
 * Gracefully disconnects and destroys the socket instance.
 * Call this on logout so stale connections don't linger.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
