const express = require('express');
const mongoose = require('mongoose');
const Habit = require('../models/Habit');
const { todayLocalString, addDaysYmd, parseYmdLocal } = require('../lib/dates');
const { applyXpDelta, HABIT_XP } = require('../lib/xp');

const router = express.Router();

router.post('/', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  const habit = await Habit.create({ userId: req.user.sub, name });
  return res.status(201).json(habit);
});

router.get('/streaks', async (req, res) => {
  try {
    const habits = await Habit.find({ userId: req.user.sub })
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

router.get('/', async (req, res) => {
  const habits = await Habit.find({ userId: req.user.sub }).sort({ createdAt: -1 }).lean();
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

  const habit = await Habit.findOne({ _id: id, userId: req.user.sub });
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
    const yStr = addDaysYmd(date, -1);
    const yEntry = habit.logs.find((l) => l.date === yStr);
    const yesterdayDone = yEntry?.status === 'done';
    habit.streak = yesterdayDone ? (habit.streak || 0) + 1 : 1;
    habit.lastCompletedDate = parseYmdLocal(date);
  } else if (status === 'missed') {
    habit.streak = 0;
    habit.lastCompletedDate = null;
  }

  await habit.save();

  const io = req.app.locals.io;

  // Handle Gamification XP
  if (priorStatus !== status) {
    let xpDelta = 0;
    if (status === 'done') {
      xpDelta = HABIT_XP;
    } else if (priorStatus === 'done' && status === 'missed') {
      xpDelta = -HABIT_XP;
    }
    await applyXpDelta({
      io,
      userId: req.user.sub,
      delta: xpDelta,
      message: xpDelta > 0 ? `Completed habit (+${xpDelta} XP)` : `Missed habit (${xpDelta} XP)`,
    });
  }

  // Emit real-time event to this user's connected clients only
  if (io) io.to(`user:${req.user.sub}`).emit('habit:updated', habit);

  return res.json(habit);
});

module.exports = router;
