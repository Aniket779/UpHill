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

function parseTags(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((t) => (typeof t === 'string' ? t.trim() : ''))
      .filter(Boolean)
      .slice(0, 12);
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);
  }
  return [];
}

router.post('/', async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }
  const p = req.body?.priority;
  const priority = p === 'low' || p === 'medium' || p === 'high' ? p : 'medium';
  const category =
    typeof req.body?.category === 'string' && req.body.category.trim()
      ? req.body.category.trim().toLowerCase()
      : 'general';
  const tags = parseTags(req.body?.tags);
  const goalId =
    typeof req.body?.goalId === 'string' && mongoose.Types.ObjectId.isValid(req.body.goalId)
      ? req.body.goalId
      : null;
  const startTime = typeof req.body?.startTime === 'string' && /^\d{2}:\d{2}$/.test(req.body.startTime) ? req.body.startTime : null;
  const duration = typeof req.body?.duration === 'number' && req.body.duration > 0 ? req.body.duration : null;
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
    startTime,
    duration,
    status: 'todo',
    category,
    tags,
    goalId,
  });
  return res.status(201).json(task);
});

router.get('/board', async (req, res) => {
  // Fetch all tasks for the Kanban board
  const tasks = await Task.find({}).lean();
  return res.json(tasks);
});

router.get('/', async (req, res) => {
  const resolved = resolveDateParam(req.query.date);
  if (!resolved.ok) {
    return res.status(400).json({ error: resolved.error });
  }
  const query = { date: resolved.date };
  if (typeof req.query.category === 'string' && req.query.category.trim()) {
    query.category = req.query.category.trim().toLowerCase();
  }
  const tasks = await Task.find(query).lean();
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
  const patch = {};
  if (typeof req.body?.completed === 'boolean') {
    patch.completed = req.body.completed;
    patch.status = req.body.completed ? 'done' : 'todo';
  }
  
  if (typeof req.body?.status === 'string' && ['todo', 'in-progress', 'done'].includes(req.body.status)) {
    patch.status = req.body.status;
    patch.completed = req.body.status === 'done';
  }

  if (typeof req.body?.category === 'string') {
    patch.category = req.body.category.trim().toLowerCase() || 'general';
  }
  if (req.body?.tags !== undefined) {
    patch.tags = parseTags(req.body.tags);
  }
  if (typeof req.body?.goalId === 'string' && mongoose.Types.ObjectId.isValid(req.body.goalId)) {
    patch.goalId = req.body.goalId;
  }
  if (req.body?.goalId === null) patch.goalId = null;

  if (typeof req.body?.startTime === 'string' && /^\d{2}:\d{2}$/.test(req.body.startTime)) patch.startTime = req.body.startTime;
  if (req.body?.startTime === null) patch.startTime = null;
  
  if (typeof req.body?.duration === 'number' && req.body.duration > 0) patch.duration = req.body.duration;
  if (req.body?.duration === null) patch.duration = null;

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'no valid fields to update' });
  }
  const task = await Task.findByIdAndUpdate(id, patch, { new: true }).lean();
  if (!task) {
    return res.status(404).json({ error: 'task not found' });
  }
  return res.json(task);
});

module.exports = router;
