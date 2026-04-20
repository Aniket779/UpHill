const http = require('http');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const habitsRouter = require('./routes/habits');
const tasksRouter = require('./routes/tasks');
const goalsRouter = require('./routes/goals');
const aiRoutes = require('./routes/ai');
const insightsRouter = require('./routes/insights');
const remindersRouter = require('./routes/reminders');
const analyticsRouter = require('./routes/analytics');
const authRouter = require('./routes/auth');
const authMiddleware = require('./middleware/auth');
const socketAuth = require('./socket/auth');

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

const mongoUri =
  process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uphill';

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

// Authenticate every socket connection with the same JWT logic as HTTP routes
io.use(socketAuth);

io.on('connection', (socket) => {
  console.log(`[socket] connected  id=${socket.id} user=${socket.user?.id ?? 'unknown'}`);
  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected id=${socket.id} reason=${reason}`);
  });
});

// Make io available to all route handlers via req.app.locals.io
app.locals.io = io;
// ──────────────────────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

mongoose
  .connect(mongoUri)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

app.use('/auth', authRouter);
app.use(authMiddleware);

app.use('/habits', habitsRouter);
app.use('/tasks', tasksRouter);
app.use('/goals', goalsRouter);
app.use('/insights', insightsRouter);
app.use('/reminders', remindersRouter);
app.use('/analytics', analyticsRouter);
app.use('/ai', aiRoutes);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
