const rateLimit = require('express-rate-limit');

// Auth: guards against credential-stuffing / brute-force on register+login.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

// AI: guards against runaway Gemini API cost from a single client.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Slow down and try again shortly.' },
});

module.exports = { authLimiter, aiLimiter };
