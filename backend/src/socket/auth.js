const jwt = require('jsonwebtoken');

/**
 * Socket.io authentication middleware.
 * Reads the JWT from socket.handshake.auth.token, verifies it,
 * and attaches the decoded payload to socket.user before calling next().
 */
function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token || '';
  if (!token) {
    return next(new Error('Authentication error: missing token'));
  }
  const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
  try {
    const payload = jwt.verify(token, secret);
    socket.user = payload;
    return next();
  } catch {
    return next(new Error('Authentication error: invalid or expired token'));
  }
}

module.exports = socketAuth;
