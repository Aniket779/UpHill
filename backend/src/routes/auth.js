const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../schemas/auth');
const config = require('../config/env');

const router = express.Router();

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7d, matches token expiry

function signUser(user) {
  return jwt.sign(
    { sub: String(user._id), email: user.email, name: user.name },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

function setSessionCookie(res, token) {
  res.cookie(config.authCookieName, token, {
    httpOnly: true,
    // In production the frontend (Vercel) and backend (Render) are on
    // different domains entirely — a genuinely cross-site request, not just
    // cross-port like local dev. SameSite=Lax cookies are never sent on
    // cross-site fetch/XHR, only same-site ones, so production needs
    // SameSite=None — which browsers require to be paired with Secure.
    secure: config.isProduction,
    sameSite: config.isProduction ? 'none' : 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

router.post('/register', validate({ body: registerSchema }), async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const exists = await User.findOne({ email }).lean();
    if (exists) {
      return res.status(409).json({ error: 'email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });
    setSessionCookie(res, signUser(user));
    return res.status(201).json({
      user: { id: String(user._id), name: user.name, email: user.email, xp: user.xp, level: user.level },
    });
  } catch (err) {
    console.error('POST /auth/register error:', err);
    return res.status(500).json({ error: 'Failed to register' });
  }
});

router.post('/login', validate({ body: loginSchema }), async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    setSessionCookie(res, signUser(user));
    return res.json({
      user: { id: String(user._id), name: user.name, email: user.email, xp: user.xp, level: user.level },
    });
  } catch (err) {
    console.error('POST /auth/login error:', err);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(config.authCookieName, {
    path: '/',
    secure: config.isProduction,
    sameSite: config.isProduction ? 'none' : 'lax',
  });
  return res.status(204).end();
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.sub).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ id: String(user._id), name: user.name, email: user.email, xp: user.xp, level: user.level });
  } catch (err) {
    console.error('GET /auth/me error:', err);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
