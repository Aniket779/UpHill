const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const config = require('./config/env');
const { authLimiter, aiLimiter } = require('./middleware/rateLimit');
const habitsRouter = require('./routes/habits');
const tasksRouter = require('./routes/tasks');
const goalsRouter = require('./routes/goals');
const aiRoutes = require('./routes/ai');
const insightsRouter = require('./routes/insights');
const remindersRouter = require('./routes/reminders');
const analyticsRouter = require('./routes/analytics');
const authRouter = require('./routes/auth');
const agentRouter = require('./routes/agent');
const notificationsRouter = require('./routes/notifications');
const authMiddleware = require('./middleware/auth');

/**
 * The Express app, with no side effects (no DB connection, no listening
 * socket) so it can be required directly by tests via supertest. Real
 * process startup — mongoose.connect, http server, Socket.io — lives in
 * index.js.
 */
const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

app.use('/auth', authLimiter, authRouter);
app.use(authMiddleware);

app.use('/habits', habitsRouter);
app.use('/tasks', tasksRouter);
app.use('/goals', goalsRouter);
app.use('/insights', insightsRouter);
app.use('/reminders', remindersRouter);
app.use('/analytics', analyticsRouter);
app.use('/ai', aiLimiter, aiRoutes);
app.use('/agent', aiLimiter, agentRouter);
app.use('/notifications', notificationsRouter);

module.exports = app;
