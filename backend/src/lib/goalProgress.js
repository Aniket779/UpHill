/**
 * Applies a progress delta to a goal linked from a task or habit (via
 * Task.goalId / Habit.goalId), clamped to [0, target], and emits
 * goal:updated to the owning user's realtime room. Mirrors the shape of
 * lib/xp.js's applyXpDelta.
 */
const Goal = require('../models/Goal');

async function applyGoalProgressDelta({ io, userId, goalId, delta }) {
  if (!delta || !goalId) return null;
  const goal = await Goal.findOne({ _id: goalId, userId });
  if (!goal) return null;

  const target = goal.target || 100;
  goal.progress = Math.max(0, Math.min(target, (goal.progress || 0) + delta));
  await goal.save();

  if (io) {
    io.to(`user:${userId}`).emit('goal:updated', goal);
  }
  return goal;
}

module.exports = { applyGoalProgressDelta };
