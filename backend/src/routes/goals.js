const express = require('express');
const mongoose = require('mongoose');
const Goal = require('../models/Goal');
const Task = require('../models/Task');
const Habit = require('../models/Habit');
const { weekStartMondayLocal } = require('../lib/dates');

const router = express.Router();

function clampProgress(n, max = Infinity) {
  if (Number.isNaN(n) || typeof n !== 'number') return 0;
  return Math.max(0, Math.min(max, Math.round(n)));
}

function clampTarget(n) {
  if (Number.isNaN(n) || typeof n !== 'number') return 100;
  return Math.max(1, Math.round(n));
}

function parseObjectIdList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v) => typeof v === 'string' && mongoose.Types.ObjectId.isValid(v));
}

router.post('/', async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }
  let weekStartDate = weekStartMondayLocal();
  if (typeof req.body?.weekStartDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.weekStartDate)) {
    weekStartDate = req.body.weekStartDate;
  }
  const target = typeof req.body?.target === 'number' ? clampTarget(req.body.target) : 100;
  const progress =
    typeof req.body?.progress === 'number' ? clampProgress(req.body.progress, target) : 0;
  const taskIds = parseObjectIdList(req.body?.taskIds);
  const habitIds = parseObjectIdList(req.body?.habitIds);

  const goal = await Goal.create({ userId: req.user.sub, title, progress, target, weekStartDate, taskIds, habitIds });
  return res.status(201).json(goal);
});

router.get('/', async (req, res) => {
  const week = weekStartMondayLocal();
  const goals = await Goal.find({ userId: req.user.sub, weekStartDate: week }).sort({ createdAt: 1 }).lean();
  return res.json(goals);
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'invalid goal id' });
  }
  const week = weekStartMondayLocal();
  const existing = await Goal.findOne({ _id: id, userId: req.user.sub, weekStartDate: week }).lean();
  if (!existing) {
    return res.status(404).json({ error: 'goal not found' });
  }
  const patch = {};
  if (typeof req.body?.target === 'number') patch.target = clampTarget(req.body.target);
  const effectiveTarget = patch.target ?? existing.target;
  if (typeof req.body?.progress === 'number') {
    patch.progress = clampProgress(req.body.progress, effectiveTarget);
  } else if (patch.target !== undefined && existing.progress > effectiveTarget) {
    // Target shrank below the existing progress — pull progress back in line.
    patch.progress = effectiveTarget;
  }
  if (req.body?.taskIds !== undefined) patch.taskIds = parseObjectIdList(req.body.taskIds);
  if (req.body?.habitIds !== undefined) patch.habitIds = parseObjectIdList(req.body.habitIds);
  if (typeof req.body?.title === 'string' && req.body.title.trim()) patch.title = req.body.title.trim();
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'no valid fields to update' });
  }
  const goal = await Goal.findOneAndUpdate(
    { _id: id, userId: req.user.sub, weekStartDate: week },
    patch,
    { returnDocument: 'after' }
  ).lean();
  if (!goal) {
    return res.status(404).json({ error: 'goal not found' });
  }

  const io = req.app.locals.io;
  if (io) io.to(`user:${req.user.sub}`).emit('goal:updated', goal);

  return res.json(goal);
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'invalid goal id' });
  }
  const goal = await Goal.findOneAndDelete({ _id: id, userId: req.user.sub });
  if (!goal) {
    return res.status(404).json({ error: 'goal not found' });
  }

  // Clear dangling references on any tasks/habits that were linked to this goal.
  await Promise.all([
    Task.updateMany({ userId: req.user.sub, goalId: id }, { goalId: null }),
    Habit.updateMany({ userId: req.user.sub, goalId: id }, { goalId: null }),
  ]);

  const io = req.app.locals.io;
  if (io) io.to(`user:${req.user.sub}`).emit('goal:deleted', { _id: goal._id });

  return res.status(204).send();
});

module.exports = router;
