const express = require('express');
const mongoose = require('mongoose');
const Goal = require('../models/Goal');

const router = express.Router();

function toYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function weekStartMondayLocal(ref = new Date()) {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return toYmd(d);
}

function clampProgress(n) {
  if (Number.isNaN(n) || typeof n !== 'number') return 0;
  return Math.max(0, Math.round(n));
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
  const progress =
    typeof req.body?.progress === 'number' ? clampProgress(req.body.progress) : 0;
  const target = typeof req.body?.target === 'number' ? clampTarget(req.body.target) : 100;
  const taskIds = parseObjectIdList(req.body?.taskIds);
  const habitIds = parseObjectIdList(req.body?.habitIds);

  const goal = await Goal.create({ title, progress, target, weekStartDate, taskIds, habitIds });
  return res.status(201).json(goal);
});

router.get('/', async (_req, res) => {
  const week = weekStartMondayLocal();
  const goals = await Goal.find({ weekStartDate: week }).sort({ createdAt: 1 }).lean();
  return res.json(goals);
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'invalid goal id' });
  }
  const patch = {};
  if (typeof req.body?.progress === 'number') patch.progress = clampProgress(req.body.progress);
  if (typeof req.body?.target === 'number') patch.target = clampTarget(req.body.target);
  if (req.body?.taskIds !== undefined) patch.taskIds = parseObjectIdList(req.body.taskIds);
  if (req.body?.habitIds !== undefined) patch.habitIds = parseObjectIdList(req.body.habitIds);
  if (typeof req.body?.title === 'string' && req.body.title.trim()) patch.title = req.body.title.trim();
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'no valid fields to update' });
  }
  const week = weekStartMondayLocal();
  const goal = await Goal.findOneAndUpdate(
    { _id: id, weekStartDate: week },
    patch,
    { new: true }
  ).lean();
  if (!goal) {
    return res.status(404).json({ error: 'goal not found' });
  }
  return res.json(goal);
});

module.exports = router;
