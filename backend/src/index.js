const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
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
const authMiddleware = require('./middleware/auth');
const socketAuth = require('./socket/auth');

const app = express();
const server = http.createServer(app);

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

// Authenticate every socket connection with the same session cookie as HTTP routes
io.use(socketAuth);

io.on('connection', (socket) => {
  const userId = socket.user?.sub;
  if (userId) socket.join(`user:${userId}`);
  console.log(`[socket] connected  id=${socket.id} user=${userId ?? 'unknown'}`);
  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected id=${socket.id} reason=${reason}`);
  });
});

// Make io available to all route handlers via req.app.locals.io
app.locals.io = io;
// ──────────────────────────────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

mongoose
  .connect(config.mongoUri)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

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
app.use('/notifications', require('./routes/notifications'));

server.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
});
