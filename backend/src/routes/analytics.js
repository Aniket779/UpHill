const express = require('express');
const Task = require('../models/Task');
const Habit = require('../models/Habit');

const router = express.Router();

function ymdOffset(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  // Use local time components so the date matches how tasks store their `date` field
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayLocal() {
  return ymdOffset(0);
}

router.get('/summary', async (_req, res) => {
  try {
    const [tasks, habits] = await Promise.all([Task.find().lean(), Habit.find().lean()]);
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.completed).length;
    const completedPercent = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const streakAvg = habits.length
      ? Number((habits.reduce((sum, h) => sum + (h.streak || 0), 0) / habits.length).toFixed(1))
      : 0;

    const completionRateGraph = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = ymdOffset(i);
      const dayTasks = tasks.filter((t) => t.date === day);
      const dayDone = dayTasks.filter((t) => t.completed).length;
      completionRateGraph.push({
        day: day.slice(5),
        rate: dayTasks.length ? Math.round((dayDone / dayTasks.length) * 100) : 0,
      });
    }

    const streakTrend = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = ymdOffset(i);
      let doneLogs = 0;
      let loggedHabits = 0;
      for (const h of habits) {
        const log = (h.logs || []).find((l) => l.date === day);
        if (log) {
          loggedHabits += 1;
          if (log.status === 'done') doneLogs += 1;
        }
      }
      streakTrend.push({
        day: day.slice(5),
        value: loggedHabits ? Math.round((doneLogs / loggedHabits) * 100) : 0,
      });
    }

    return res.json({
      totalTasks,
      completedPercent,
      streakAvg,
      completionRateGraph,
      streakTrend,
    });
  } catch (err) {
    console.error('GET /analytics/summary error:', err);
    return res.status(500).json({ error: 'Failed to load analytics summary.' });
  }
});

router.get('/contributions', async (_req, res) => {
  try {
    const [tasks, habits] = await Promise.all([Task.find().lean(), Habit.find().lean()]);
    const activityMap = {};

    for (const t of tasks) {
      if (t.completed && t.date) {
        activityMap[t.date] = (activityMap[t.date] || 0) + 1;
      }
    }

    for (const h of habits) {
      for (const log of h.logs || []) {
        if (log.status === 'done' && log.date) {
          activityMap[log.date] = (activityMap[log.date] || 0) + 1;
        }
      }
    }

    const totalActivity = Object.values(activityMap).reduce((sum, count) => sum + count, 0);

    let currentStreak = 0;
    let longestStreak = 0;
    const contributions = [];
    let tempStreak = 0;
    
    // Build array for the last 365 days
    for (let i = 364; i >= 0; i -= 1) {
      const day = ymdOffset(i);
      const count = activityMap[day] || 0;
      contributions.push({ date: day, count });
      
      if (count > 0) {
        tempStreak += 1;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }
    
    // Current streak is tempStreak because the loop ends on today (i=0)
    currentStreak = tempStreak;

    return res.json({
      contributions,
      totalActivity,
      currentStreak,
      longestStreak
    });
  } catch (err) {
    console.error('GET /analytics/contributions error:', err);
    return res.status(500).json({ error: 'Failed to load contributions.' });
  }
});

module.exports = router;
