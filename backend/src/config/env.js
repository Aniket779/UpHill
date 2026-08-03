const dotenv = require('dotenv');

dotenv.config();

function required(name, { fallbackNames = [] } = {}) {
  for (const key of [name, ...fallbackNames]) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  throw new Error(
    `Missing required environment variable: ${name}. Set it in backend/.env (see .env.example).`
  );
}

function optional(name, defaultValue = undefined) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : defaultValue;
}

const config = {
  port: Number(optional('PORT', '5000')),
  mongoUri: required('MONGODB_URI', { fallbackNames: ['MONGO_URI'] }),
  jwtSecret: required('JWT_SECRET'),
  geminiApiKey: optional('GEMINI_API_KEY'),
  geminiModel: optional('GEMINI_MODEL', 'gemini-3.1-flash-lite-preview'),
  corsOrigins: optional('CORS_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  nodeEnv: optional('NODE_ENV', 'development'),
  authCookieName: 'uphill_session',
};

config.isProduction = config.nodeEnv === 'production';

if (config.jwtSecret === 'dev_jwt_secret_change_me') {
  throw new Error(
    'JWT_SECRET is set to the placeholder value "dev_jwt_secret_change_me" — generate a real secret.'
  );
}

if (!config.geminiApiKey) {
  console.warn('[config] GEMINI_API_KEY is not set — AI features (/ai/*, /agent/*) will return 503.');
}

module.exports = config;
