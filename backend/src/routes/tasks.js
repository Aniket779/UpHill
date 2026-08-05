const express = require('express');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const { todayLocalString, parseYmdLocal } = require('../lib/dates');
const { applyXpDelta, taskXpBase } = require('../lib/xp');
const { applyGoalProgressDelta } = require('../lib/goalProgress');

const router = express.Router();

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

function parseRecurrence(raw) {
  const daysOfWeek = Array.isArray(raw?.daysOfWeek)
    ? [...new Set(raw.daysOfWeek.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : [];
  const until =
    typeof raw?.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.until) ? raw.until : null;
  const active = raw?.active === true && daysOfWeek.length > 0;
  return { active, daysOfWeek, until };
}

/**
 * Lazily materializes today's (or any queried date's) instances of active
 * recurring task templates. A "template" is just the task the user originally
 * created with recurrence.active=true; every other date's instance is a
 * lightweight copy linked back via recurringParentId, generated on first read
 * rather than pre-created in bulk (no cron/worker infra in this deployment).
 */
async function materializeRecurringInstances(userId, date) {
  const dow = parseYmdLocal(date).getDay();
  const templates = await Task.find({
    userId,
    recurringParentId: null,
    'recurrence.active': true,
    date: { $lte: date },
    $or: [{ 'recurrence.until': null }, { 'recurrence.until': { $gte: date } }],
  }).lean();

  for (const tpl of templates) {
    if (tpl.date === date) continue; // the template itself already represents this date
    if (!tpl.recurrence.daysOfWeek.includes(dow)) continue;

    const exists = await Task.exists({ userId, date, recurringParentId: tpl._id });
    if (exists) continue;

    await Task.create({
      userId,
      title: tpl.title,
      completed: false,
      priority: tpl.priority,
      date,
      startTime: null,
      duration: null,
      status: 'todo',
      category: tpl.category,
      tags: tpl.tags,
      goalId: tpl.goalId,
      recurrence: { active: false, daysOfWeek: [], until: null },
      recurringParentId: tpl._id,
    });
  }
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
  const recurrence = parseRecurrence(req.body?.recurrence);

  const task = await Task.create({
    userId: req.user.sub,
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
    recurrence,
    recurringParentId: null,
  });

  // Emit real-time event to this user's connected clients only
  const io = req.app.locals.io;
  if (io) io.to(`user:${req.user.sub}`).emit('task:created', task);

  return res.status(201).json(task);
});

router.get('/board', async (req, res) => {
  // Fetch this user's tasks for the Kanban board
  const tasks = await Task.find({ userId: req.user.sub }).lean();
  return res.json(tasks);
});

router.get('/', async (req, res) => {
  const resolved = resolveDateParam(req.query.date);
  if (!resolved.ok) {
    return res.status(400).json({ error: resolved.error });
  }
  await materializeRecurringInstances(req.user.sub, resolved.date);
  const query = { userId: req.user.sub, date: resolved.date };
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
    patch.completedAt = req.body.completed ? new Date() : null;
  }

  if (typeof req.body?.status === 'string' && ['todo', 'in-progress', 'done'].includes(req.body.status)) {
    patch.status = req.body.status;
    patch.completed = req.body.status === 'done';
    patch.completedAt = patch.completed ? new Date() : null;
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

  if (typeof req.body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date)) {
    patch.date = req.body.date;
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'no valid fields to update' });
  }

  const oldTask = await Task.findOne({ _id: id, userId: req.user.sub }).lean();
  if (!oldTask) {
    return res.status(404).json({ error: 'task not found' });
  }

  const task = await Task.findOneAndUpdate({ _id: id, userId: req.user.sub }, patch, { returnDocument: 'after' }).lean();
  if (!task) {
    return res.status(404).json({ error: 'task not found' });
  }

  // Handle Gamification XP
  const wasCompleted = oldTask.completed;
  const isCompleted = task.completed;
  const io = req.app.locals.io;

  if (wasCompleted !== isCompleted) {
    const base = taskXpBase(task.priority);
    const xpDelta = isCompleted ? base : -base;
    await applyXpDelta({
      io,
      userId: req.user.sub,
      delta: xpDelta,
      message: isCompleted ? `Completed task (+${xpDelta} XP)` : `Uncompleted task (${xpDelta} XP)`,
    });
    if (task.goalId) {
      await applyGoalProgressDelta({
        io,
        userId: req.user.sub,
        goalId: task.goalId,
        delta: isCompleted ? 1 : -1,
      });
    }
  }

  // Emit real-time event to this user's connected clients only
  if (io) io.to(`user:${req.user.sub}`).emit('task:updated', task);

  return res.json(task);
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'invalid task id' });
  }

  const task = await Task.findOneAndDelete({ _id: id, userId: req.user.sub });
  if (!task) {
    return res.status(404).json({ error: 'task not found' });
  }

  const io = req.app.locals.io;

  if (task.completed) {
    const base = taskXpBase(task.priority);
    await applyXpDelta({
      io,
      userId: req.user.sub,
      delta: -base,
      message: `Deleted completed task (${-base} XP)`,
    });
    if (task.goalId) {
      await applyGoalProgressDelta({ io, userId: req.user.sub, goalId: task.goalId, delta: -1 });
    }
  }

  if (io) io.to(`user:${req.user.sub}`).emit('task:deleted', { _id: task._id });

  return res.status(204).send();
});

module.exports = router;
