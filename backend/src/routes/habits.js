const express = require('express');
const mongoose = require('mongoose');
const Habit = require('../models/Habit');

const router = express.Router();

function todayLocalString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function prevDayYmd(ymd) {
  const [y, mo, da] = ymd.split('-').map(Number);
  const dt = new Date(y, mo - 1, da);
  dt.setDate(dt.getDate() - 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

router.post('/', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  const habit = await Habit.create({ name });
  return res.status(201).json(habit);
});

router.get('/streaks', async (_req, res) => {
  try {
    const habits = await Habit.find()
      .select('name streak lastCompletedDate')
      .sort({ streak: -1, name: 1 })
      .lean();
    const rows = habits.map((h) => ({
      habitId: String(h._id),
      name: h.name,
      streak: h.streak ?? 0,
      lastCompletedDate: h.lastCompletedDate ?? null,
    }));
    return res.json(rows);
  } catch (err) {
    console.error('GET /habits/streaks error:', err);
    return res.status(500).json({ error: 'Failed to load streaks.' });
  }
});

router.get('/', async (_req, res) => {
  const habits = await Habit.find().sort({ createdAt: -1 }).lean();
  return res.json(habits);
});

router.post('/:id/log', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'invalid habit id' });
  }
  const raw = req.body?.status;
  const status = raw === 'missed' ? 'missed' : raw === 'done' ? 'done' : null;
  if (!status) {
    return res.status(400).json({ error: 'status must be "done" or "missed"' });
  }
  const date = typeof req.body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date)
    ? req.body.date
    : todayLocalString();

  const habit = await Habit.findById(id);
  if (!habit) {
    return res.status(404).json({ error: 'habit not found' });
  }

  const idx = habit.logs.findIndex((l) => l.date === date);
  const priorStatus = idx >= 0 ? habit.logs[idx].status : null;
  if (idx >= 0) {
    habit.logs[idx].status = status;
  } else {
    habit.logs.push({ date, status });
  }

  if (status === 'done' && priorStatus !== 'done') {
    const yStr = prevDayYmd(date);
    const yEntry = habit.logs.find((l) => l.date === yStr);
    const yesterdayDone = yEntry?.status === 'done';
    habit.streak = yesterdayDone ? (habit.streak || 0) + 1 : 1;
    const [yy, mm, dd] = date.split('-').map(Number);
    habit.lastCompletedDate = new Date(yy, mm - 1, dd);
  } else if (status === 'missed') {
    habit.streak = 0;
    habit.lastCompletedDate = null;
  }

  await habit.save();

  // Emit real-time event to all connected clients
  const io = req.app.locals.io;
  if (io) io.emit('habit:updated', habit);

  return res.json(habit);
});

module.exports = router;
