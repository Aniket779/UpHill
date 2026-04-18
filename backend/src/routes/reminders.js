const express = require('express');
const Task = require('../models/Task');
const Habit = require('../models/Habit');

const router = express.Router();

function todayLocalString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysYmd(ymd, deltaDays) {
  const [y, mo, da] = ymd.split('-').map(Number);
  const dt = new Date(y, mo - 1, da);
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Consecutive calendar days with a `done` log, walking backward from endYmd (inclusive). */
function countDoneCalendarStreakFrom(logs, endYmd) {
  const map = new Map((logs || []).map((l) => [l.date, l.status]));
  let count = 0;
  let cur = endYmd;
  for (;;) {
    if (map.get(cur) === 'done') {
      count += 1;
      cur = addDaysYmd(cur, -1);
    } else {
      break;
    }
  }
  return count;
}

router.get('/', async (_req, res) => {
  try {
    const today = todayLocalString();
    const yesterday = addDaysYmd(today, -1);

    const [tasks, habits] = await Promise.all([
      Task.find({ date: today }).lean(),
      Habit.find().lean(),
    ]);

    const reminders = [];
    const openTasks = tasks.filter((t) => !t.completed);
    const openHigh = openTasks.filter((t) => t.priority === 'high');
    const rank = { high: 0, medium: 1, low: 2 };
    const sortedOpenHigh = [...openHigh].sort((a, b) => rank[a.priority] - rank[b.priority] || a.title.localeCompare(b.title));

    if (sortedOpenHigh.length > 0) {
      const t = sortedOpenHigh[0];
      reminders.push({
        code: 'HIGH_TASK_OPEN',
        topic: 'tasks',
        level: 'warning',
        text: `You haven't completed your main task today — "${t.title}" is still open (high priority).`,
      });
    } else if (openTasks.length > 0) {
      reminders.push({
        code: 'OPEN_TASKS_LEFT',
        topic: 'tasks',
        level: 'info',
        text:
          openTasks.length === 1
            ? 'You still have 1 open task for today — close it out while you have focus.'
            : `You still have ${openTasks.length} open tasks for today — knock down the smallest one first.`,
      });
    }

    const missedToday = [];
    const streakAtRisk = [];

    for (const h of habits) {
      const logs = h.logs || [];
      const todayLog = logs.find((l) => l.date === today);
      if (todayLog?.status === 'missed') {
        missedToday.push(h.name);
      }
      if (!todayLog) {
        const streakThroughYesterday = countDoneCalendarStreakFrom(logs, yesterday);
        if (streakThroughYesterday >= 2) {
          streakAtRisk.push({ name: h.name, days: streakThroughYesterday });
        }
      }
    }

    if (missedToday.length > 0) {
      reminders.push({
        code: 'HABIT_MISSED_TODAY',
        topic: 'habits',
        level: 'alert',
        text:
          missedToday.length === 1
            ? `You marked "${missedToday[0]}" as missed today — recover tomorrow or adjust the habit so it's realistic.`
            : `Missed habits today: ${missedToday.map((n) => `"${n}"`).join(', ')} — tighten the plan or reduce scope.`,
      });
    }

    for (const s of streakAtRisk) {
      reminders.push({
        code: 'STREAK_AT_RISK',
        topic: 'habits',
        level: 'warning',
        text: `Your streak is at risk — "${s.name}" had ${s.days} consecutive done day(s) through yesterday, but today isn't logged yet.`,
      });
    }

    return res.json({
      asOfDate: today,
      reminders,
      summary: {
        openTasks: openTasks.length,
        openHighPriority: openHigh.length,
        missedHabitsToday: missedToday.length,
        streaksAtRisk: streakAtRisk.length,
      },
    });
  } catch (err) {
    console.error('Reminders error:', err);
    return res.status(500).json({ error: 'Failed to build reminders.' });
  }
});

module.exports = router;
