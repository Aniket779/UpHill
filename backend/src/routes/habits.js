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

router.post('/', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  const habit = await Habit.create({ name });
  return res.status(201).json(habit);
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
  if (idx >= 0) {
    habit.logs[idx].status = status;
  } else {
    habit.logs.push({ date, status });
  }
  await habit.save();
  return res.json(habit);
});

module.exports = router;
