const express = require('express');
const mongoose = require('mongoose');
const Task = require('../models/Task');

const router = express.Router();

function todayLocalString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function resolveDateParam(raw) {
  if (raw === 'today' || raw === undefined || raw === '') {
    return { ok: true, date: todayLocalString() };
  }
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { ok: true, date: raw };
  }
  return { ok: false, error: 'date must be "today" or YYYY-MM-DD' };
}

router.post('/', async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }
  const p = req.body?.priority;
  const priority = p === 'low' || p === 'medium' || p === 'high' ? p : 'medium';
  const dateParam = resolveDateParam(req.body?.date);
  if (!dateParam.ok) {
    return res.status(400).json({ error: dateParam.error });
  }
  const date = dateParam.date;

  const task = await Task.create({
    title,
    completed: false,
    priority,
    date,
  });
  return res.status(201).json(task);
});

router.get('/', async (req, res) => {
  const resolved = resolveDateParam(req.query.date);
  if (!resolved.ok) {
    return res.status(400).json({ error: resolved.error });
  }
  const tasks = await Task.find({ date: resolved.date }).lean();
  const rank = { high: 0, medium: 1, low: 2 };
  tasks.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return rank[a.priority] - rank[b.priority];
  });
  return res.json(tasks);
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'invalid task id' });
  }
  if (typeof req.body?.completed !== 'boolean') {
    return res.status(400).json({ error: 'completed (boolean) is required' });
  }
  const task = await Task.findByIdAndUpdate(
    id,
    { completed: req.body.completed },
    { new: true }
  ).lean();
  if (!task) {
    return res.status(404).json({ error: 'task not found' });
  }
  return res.json(task);
});

module.exports = router;
