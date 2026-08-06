const http = require('http');
const dns = require('dns');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const config = require('./config/env');
const socketAuth = require('./socket/auth');
const app = require('./app');

// Node's own DNS resolver can fail SRV lookups (mongodb+srv://) against some
// router/ISP DNS servers even when the OS resolver handles them fine — force
// a public resolver so the Atlas SRV record always resolves correctly.
dns.setServers(['8.8.8.8', '1.1.1.1']);

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

mongoose
  .connect(config.mongoUri)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

server.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
});
