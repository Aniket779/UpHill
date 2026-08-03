/**
 * Shared XP/leveling logic — previously duplicated (with the User lookup,
 * save, and xp:updated emit repeated near-identically) across the task
 * completion and habit logging routes.
 */
const User = require('../models/User');

/** XP awarded for completing a task, by priority. Preserves the original
 * fallback: anything that isn't exactly 'high' or 'medium' is treated as low. */
function taskXpBase(priority) {
  if (priority === 'high') return 50;
  if (priority === 'medium') return 30;
  return 10;
}

const HABIT_XP = 20;

/**
 * Applies an XP delta to a user (never below 0), recomputes their level,
 * persists it, and emits xp:updated to that user's own realtime room.
 * No-ops if delta is 0 or the user can't be found.
 */
async function applyXpDelta({ io, userId, delta, message }) {
  if (!delta) return null;
  const user = await User.findById(userId);
  if (!user) return null;

  user.xp = Math.max(0, (user.xp || 0) + delta);
  user.level = Math.floor(user.xp / 100) + 1;
  await user.save();

  if (io) {
    io.to(`user:${userId}`).emit('xp:updated', { xp: user.xp, level: user.level, delta, message });
  }
  return user;
}

module.exports = { applyXpDelta, taskXpBase, HABIT_XP };
