const jwt = require('jsonwebtoken');
const config = require('../config/env');

function parseCookieHeader(rawCookie) {
  const out = {};
  for (const part of (rawCookie || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

/**
 * Socket.io authentication middleware.
 * Reads the JWT from the same httpOnly session cookie the HTTP API uses
 * (sent automatically by the browser when the client connects with
 * withCredentials: true), verifies it, and attaches the decoded payload
 * to socket.user before calling next().
 */
function socketAuth(socket, next) {
  const parsed = parseCookieHeader(socket.handshake.headers?.cookie);
  const token = parsed[config.authCookieName];
  if (!token) {
    return next(new Error('Authentication error: missing session'));
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    socket.user = payload;
    return next();
  } catch {
    return next(new Error('Authentication error: invalid or expired session'));
  }
}

module.exports = socketAuth;
