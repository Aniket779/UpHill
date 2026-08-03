import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/+$/, '')
  : 'http://localhost:5000'

let socket = null

/**
 * Returns the shared socket instance, creating and connecting it on first call.
 * withCredentials sends the httpOnly session cookie in the handshake so the
 * backend can authenticate the connection the same way it does HTTP requests.
 */
export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })
  }

  if (!socket.connected) {
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
