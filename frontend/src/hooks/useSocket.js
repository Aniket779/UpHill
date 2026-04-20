import { useEffect, useRef } from 'react'
import { getSocket } from '../lib/socket'

/**
 * Subscribes to a Socket.io event for the lifetime of the component.
 * Automatically cleans up the listener on unmount.
 *
 * @param {string} eventName  - The socket event to listen to (e.g. 'task:created')
 * @param {Function} callback - Handler called with the event payload
 */
export function useSocket(eventName, callback) {
  // Keep a stable ref to the latest callback so we don't re-subscribe on every render
  const callbackRef = useRef(callback)
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    const socket = getSocket()
    const handler = (data) => callbackRef.current(data)
    socket.on(eventName, handler)

    return () => {
      socket.off(eventName, handler)
    }
  }, [eventName]) // Only re-subscribe if the event name changes
}
