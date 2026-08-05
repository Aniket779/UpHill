const express = require('express');
const mongoose = require('mongoose');
const Habit = require('../models/Habit');
const { todayLocalString, parseYmdLocal } = require('../lib/dates');
const { applyXpDelta, HABIT_XP } = require('../lib/xp');
const { applyGoalProgressDelta } = require('../lib/goalProgress');
const { previousScheduledDate } = require('../lib/habitLogs');

const router = express.Router();

function parseScheduledDays(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
}

router.post('/', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  const scheduledDays = parseScheduledDays(req.body?.scheduledDays);
  const goalId =
    typeof req.body?.goalId === 'string' && mongoose.Types.ObjectId.isValid(req.body.goalId)
      ? req.body.goalId
      : null;
  const habit = await Habit.create({ userId: req.user.sub, name, scheduledDays, goalId });
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

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'invalid habit id' });
  }
  const patch = {};
  if (req.body?.scheduledDays !== undefined) {
    patch.scheduledDays = parseScheduledDays(req.body.scheduledDays);
  }
  if (typeof req.body?.goalId === 'string' && mongoose.Types.ObjectId.isValid(req.body.goalId)) {
    patch.goalId = req.body.goalId;
  }
  if (req.body?.goalId === null) patch.goalId = null;

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'no valid fields to update' });
  }

  const habit = await Habit.findOneAndUpdate({ _id: id, userId: req.user.sub }, patch, {
    returnDocument: 'after',
  });
  if (!habit) {
    return res.status(404).json({ error: 'habit not found' });
  }

  const io = req.app.locals.io;
  if (io) io.to(`user:${req.user.sub}`).emit('habit:updated', habit);

  return res.json(habit);
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'invalid habit id' });
  }
  const habit = await Habit.findOneAndDelete({ _id: id, userId: req.user.sub });
  if (!habit) {
    return res.status(404).json({ error: 'habit not found' });
  }

  const io = req.app.locals.io;
  if (io) io.to(`user:${req.user.sub}`).emit('habit:deleted', { _id: habit._id });

  return res.status(204).send();
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
    const prevScheduled = previousScheduledDate(habit.scheduledDays, date);
    const prevEntry = habit.logs.find((l) => l.date === prevScheduled);
    const prevDone = prevEntry?.status === 'done';
    habit.streak = prevDone ? (habit.streak || 0) + 1 : 1;
    habit.lastCompletedDate = require('../lib/dates').parseYmdLocal(date);
  } else if (status === 'missed') {
    habit.streak = 0;
    habit.lastCompletedDate = null;
  }

  await habit.save();

  const io = req.app.locals.io;

  // Handle Gamification XP + linked-goal progress
  let direction = 0;
  if (status === 'done' && priorStatus !== 'done') direction = 1;
  else if (priorStatus === 'done' && status === 'missed') direction = -1;

  if (direction !== 0) {
    const xpDelta = direction * HABIT_XP;
    await applyXpDelta({
      io,
      userId: req.user.sub,
      delta: xpDelta,
      message: xpDelta > 0 ? `Completed habit (+${xpDelta} XP)` : `Missed habit (${xpDelta} XP)`,
    });
    if (habit.goalId) {
      await applyGoalProgressDelta({ io, userId: req.user.sub, goalId: habit.goalId, delta: direction });
    }
  }

  // Emit real-time event to this user's connected clients only
  if (io) io.to(`user:${req.user.sub}`).emit('habit:updated', habit);

  return res.json(habit);
});

module.exports = router;
