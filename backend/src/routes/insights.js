const express = require('express');
const Habit = require('../models/Habit');
const Task = require('../models/Task');

const router = express.Router();

function addDaysYmd(ymd, deltaDays) {
  const [y, mo, da] = ymd.split('-').map(Number);
  const dt = new Date(y, mo - 1, da);
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

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

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function todayLocalString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseWindowDays(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 7) return 90;
  return Math.min(365, Math.floor(n));
}

function filterLogsByWindow(logs, cutoffDate) {
  return (logs || []).filter((l) => l.date >= cutoffDate);
}

function parseYmdLocal(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function countStreakBreaks(sortedLogs) {
  let prev = null;
  let breaks = 0;
  for (const log of sortedLogs) {
    if (log.status === 'missed' && prev === 'done') breaks += 1;
    if (log.status === 'done' || log.status === 'missed') prev = log.status;
  }
  return breaks;
}

function sortLogsByDate(logs) {
  return [...(logs || [])].sort((a, b) => a.date.localeCompare(b.date));
}

/** Smart reminder copy for Today / Habits banners (GET /insights/reminders). */
router.get('/reminders', async (_req, res) => {
  try {
    const today = todayLocalString();
    const yesterday = addDaysYmd(today, -1);

    const [tasks, habits] = await Promise.all([
      Task.find({ date: today }).lean(),
      Habit.find().lean(),
    ]);

    const openHigh = tasks.filter((t) => !t.completed && t.priority === 'high');
    const completedToday = tasks.filter((t) => t.completed).length;
    const hasTasksToday = tasks.length > 0;

    const streakAtRisk = [];
    for (const h of habits) {
      const logs = h.logs || [];
      const todayLog = logs.find((l) => l.date === today);
      if (!todayLog) {
        const streakThroughYesterday = countDoneCalendarStreakFrom(logs, yesterday);
        if (streakThroughYesterday >= 2) {
          streakAtRisk.push(h.name);
        }
      }
    }

    const messages = [];

    if (openHigh.length > 0) {
      messages.push({
        code: 'AVOIDING_IMPORTANT',
        topic: 'tasks',
        level: 'warning',
        text: 'You are avoiding important work',
      });
    }

    if (hasTasksToday && completedToday === 0) {
      messages.push({
        code: 'NOT_STARTED',
        topic: 'tasks',
        level: 'warning',
        text: "You haven't started yet",
      });
    }

    if (streakAtRisk.length > 0) {
      messages.push({
        code: 'STREAK_AT_RISK',
        topic: 'habits',
        level: 'warning',
        text: 'Your streak is at risk',
      });
    }

    const emptyHint =
      messages.length === 0
        ? "You're on track — no urgent nudges from today's rules."
        : null;

    return res.json({
      asOfDate: today,
      messages,
      emptyHint,
    });
  } catch (err) {
    console.error('GET /insights/reminders error:', err);
    return res.status(500).json({ error: 'Failed to load insight reminders.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const windowDays = parseWindowDays(req.query.windowDays);
    const today = todayLocalString();
    const cutoffDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() - windowDays);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    })();

    const habits = await Habit.find().lean();

    let totalDone = 0;
    let totalMissed = 0;
    let globalStreakBreaks = 0;

    const habitStats = habits.map((h) => {
      const logs = sortLogsByDate(filterLogsByWindow(h.logs, cutoffDate));
      let done = 0;
      let missed = 0;
      const missesByWeekday = [0, 0, 0, 0, 0, 0, 0];

      for (const log of logs) {
        if (log.status === 'done') done += 1;
        else if (log.status === 'missed') {
          missed += 1;
          try {
            const wd = parseYmdLocal(log.date).getDay();
            missesByWeekday[wd] += 1;
          } catch {
            /* skip bad date */
          }
        }
      }

      const total = done + missed;
      const missRate = total > 0 ? missed / total : 0;
      globalStreakBreaks += countStreakBreaks(logs);

      totalDone += done;
      totalMissed += missed;

      return {
        id: String(h._id),
        name: h.name,
        done,
        missed,
        total,
        missRate,
        missesByWeekday,
        logs,
      };
    });

    const habitsWithLogs = habitStats.filter((h) => h.total > 0);
    const consistencyPercent =
      totalDone + totalMissed > 0
        ? Math.round((100 * totalDone) / (totalDone + totalMissed))
        : null;

    let mostMissedHabit = null;
    let maxMisses = -1;
    for (const h of habitStats) {
      if (h.missed > maxMisses) {
        maxMisses = h.missed;
        mostMissedHabit = { name: h.name, missCount: h.missed, habitId: h.id };
      }
    }
    if (maxMisses <= 0) mostMissedHabit = null;

    let weakestHabit = null;
    let worstRate = -1;
    for (const h of habitsWithLogs) {
      if (h.total < 2) continue;
      if (h.missRate > worstRate) {
        worstRate = h.missRate;
        weakestHabit = {
          name: h.name,
          missRate: Math.round(h.missRate * 100),
          consistencyPercent: Math.round((100 * h.done) / h.total),
          totalCheckIns: h.total,
          habitId: h.id,
        };
      }
    }

    const insights = [];

    if (habits.length === 0) {
      insights.push('No habits yet — add a few check-ins so patterns can surface.');
    } else if (habitsWithLogs.length === 0) {
      insights.push(
        `No habit logs in the last ${windowDays} days. Log done or missed days to unlock insights.`
      );
    } else {
      if (consistencyPercent !== null) {
        insights.push(
          `Overall consistency (logged done vs missed) in the last ${windowDays} days: ${consistencyPercent}%.`
        );
      }

      if (weakestHabit) {
        insights.push(
          `Weakest signal: "${weakestHabit.name}" — only ${weakestHabit.consistencyPercent}% of your logged days are marked done (${weakestHabit.totalCheckIns} check-ins).`
        );
      }

      if (mostMissedHabit && mostMissedHabit.missCount > 0) {
        insights.push(
          `Most missed habit by volume: "${mostMissedHabit.name}" with ${mostMissedHabit.missCount} missed day(s) in this window.`
        );
      }

      if (globalStreakBreaks > 0) {
        insights.push(
          `Streak breaks detected: ${globalStreakBreaks} time(s) a "missed" log followed a "done" log (same habit, chronological order).`
        );
      }

      let bestPattern = null;
      for (const h of habitStats) {
        if (h.missed < 2) continue;
        let maxWd = 0;
        let maxC = 0;
        for (let wd = 0; wd < 7; wd += 1) {
          if (h.missesByWeekday[wd] > maxC) {
            maxC = h.missesByWeekday[wd];
            maxWd = wd;
          }
        }
        if (maxC >= 2 && maxC / h.missed >= 0.35) {
          if (!bestPattern || maxC > bestPattern.count) {
            bestPattern = { habit: h.name, weekday: maxWd, count: maxC, totalMisses: h.missed };
          }
        }
      }

      if (bestPattern) {
        insights.push(
          `Calendar pattern: you often miss "${bestPattern.habit}" on ${WEEKDAYS[bestPattern.weekday]}s (${bestPattern.count} of ${bestPattern.totalMisses} misses in the window).`
        );
      } else {
        insights.push(
          'No strong weekday miss pattern yet — keep logging; time-of-day is not stored, only dates.'
        );
      }
    }

    return res.json({
      windowDays,
      asOfDate: today,
      weakestHabit,
      consistencyPercent,
      mostMissedHabit,
      streakBreaks: globalStreakBreaks,
      insights,
    });
  } catch (err) {
    console.error('Insights error:', err);
    return res.status(500).json({ error: 'Failed to compute insights.' });
  }
});

// ─── GET /insights/predictions ────────────────────────────────────────────────
// Pure heuristic engine — no ML. Scores the user across multiple signals,
// maps to a risk level, and returns a single prediction + reason.

router.get('/predictions', async (_req, res) => {
  try {
    const today = todayLocalString();

    // Build last-7 and last-3 day arrays
    const days7 = [];
    const days3 = [];
    for (let i = 6; i >= 0; i--) {
      days7.push(addDaysYmd(today, -i));
    }
    for (let i = 2; i >= 0; i--) {
      days3.push(addDaysYmd(today, -i));
    }

    const [tasks, habits] = await Promise.all([
      Task.find({ date: { $in: days7 } }).lean(),
      Habit.find().lean(),
    ]);

    // ── Signal 1: Task completion rate – last 3 days ──────────────────────────
    const tasks3 = tasks.filter((t) => days3.includes(t.date));
    const done3 = tasks3.filter((t) => t.completed).length;
    const rate3 = tasks3.length > 0 ? Math.round((done3 / tasks3.length) * 100) : null;

    // ── Signal 2: Task completion rate – last 7 days ──────────────────────────
    const done7 = tasks.filter((t) => t.completed).length;
    const rate7 = tasks.length > 0 ? Math.round((done7 / tasks.length) * 100) : null;

    // ── Signal 3: Habit streak trend (is the daily done-rate going down?) ─────
    // Compare first-half avg vs second-half avg of the 7-day window
    const firstHalf = days7.slice(0, 3);
    const secondHalf = days7.slice(4); // last 3 days

    function habitDoneRateForDays(dayArr) {
      let total = 0;
      let done = 0;
      for (const h of habits) {
        for (const d of dayArr) {
          const log = (h.logs || []).find((l) => l.date === d);
          if (log) {
            total += 1;
            if (log.status === 'done') done += 1;
          }
        }
      }
      return total > 0 ? Math.round((done / total) * 100) : null;
    }

    const habitRateFirst = habitDoneRateForDays(firstHalf);
    const habitRateLast = habitDoneRateForDays(secondHalf);
    const streakDeclining =
      habitRateFirst !== null &&
      habitRateLast !== null &&
      habitRateLast < habitRateFirst - 15; // at least 15pp drop = meaningful decline

    // ── Signal 4: Consecutive habit misses across any habit ───────────────────
    let maxConsecutiveMisses = 0;
    let habitWithMostMisses = null;
    for (const h of habits) {
      let streak = 0;
      for (let i = days7.length - 1; i >= 0; i--) {
        const log = (h.logs || []).find((l) => l.date === days7[i]);
        if (!log || log.status !== 'done') {
          streak += 1;
        } else {
          break;
        }
      }
      if (streak > maxConsecutiveMisses) {
        maxConsecutiveMisses = streak;
        habitWithMostMisses = h.name;
      }
    }

    // ── Signal 5: High-priority task avoidance ────────────────────────────────
    const highTotal = tasks.filter((t) => t.priority === 'high').length;
    const highDone = tasks.filter((t) => t.priority === 'high' && t.completed).length;
    const highMissed = highTotal - highDone;
    const avoidingHighPriority = highTotal >= 2 && highMissed / highTotal >= 0.6;

    // ── Scoring ───────────────────────────────────────────────────────────────
    // Each signal contributes a "risk score" (0–1). Weighted sum → final score.
    let score = 0;
    const signals = [];

    // Signal 1 (weight: 0.35) — recent 3-day completion
    if (rate3 !== null) {
      const s1 = rate3 < 50 ? 1 : rate3 < 70 ? 0.5 : 0;
      score += s1 * 0.35;
      if (s1 > 0) signals.push(`${rate3}% task completion over the last 3 days`);
    }

    // Signal 2 (weight: 0.20) — 7-day completion
    if (rate7 !== null) {
      const s2 = rate7 < 50 ? 1 : rate7 < 70 ? 0.4 : 0;
      score += s2 * 0.20;
      if (s2 > 0 && rate7 !== rate3) signals.push(`${rate7}% task completion over the last 7 days`);
    }

    // Signal 3 (weight: 0.20) — habit trend declining
    if (streakDeclining) {
      score += 0.20;
      signals.push(`Habit consistency dropped from ${habitRateFirst}% to ${habitRateLast}% over the week`);
    }

    // Signal 4 (weight: 0.15) — consecutive misses
    if (maxConsecutiveMisses >= 3 && habitWithMostMisses) {
      const s4 = maxConsecutiveMisses >= 5 ? 1 : 0.5;
      score += s4 * 0.15;
      signals.push(`"${habitWithMostMisses}" missed ${maxConsecutiveMisses} days in a row`);
    }

    // Signal 5 (weight: 0.10) — high priority avoidance
    if (avoidingHighPriority) {
      score += 0.10;
      signals.push(`${highMissed} of ${highTotal} high-priority tasks left incomplete`);
    }

    // ── Risk classification ───────────────────────────────────────────────────
    let riskLevel;
    let prediction;
    let reason;

    if (score >= 0.55) {
      riskLevel = 'high';
      if (rate3 !== null && rate3 < 50) {
        prediction = "You are very likely to miss tomorrow's tasks at the current rate.";
        reason = signals[0] || `Low completion rate (${rate3}%) over the last 3 days.`;
      } else if (streakDeclining) {
        prediction = 'Your habit streaks are collapsing — expect a rough next 48 hours.';
        reason = `Habit consistency fell from ${habitRateFirst}% to ${habitRateLast}% this week.`;
      } else {
        prediction = 'High chance of a missed day tomorrow — multiple warning signs active.';
        reason = signals.slice(0, 2).join('; ');
      }
    } else if (score >= 0.25) {
      riskLevel = 'medium';
      if (streakDeclining) {
        prediction = 'Consistency is softening — streak may break in the next 2 days.';
        reason = `Habit done-rate dropped from ${habitRateFirst}% to ${habitRateLast}% across the week.`;
      } else if (rate3 !== null && rate3 < 70) {
        prediction = "Moderate risk: recent completion dip may carry into tomorrow.";
        reason = `${rate3}% task completion over the last 3 days — below a sustainable pace.`;
      } else {
        prediction = 'Performance is uneven — tighten up today to avoid a slump.';
        reason = signals[0] || 'Mixed signals across tasks and habits this week.';
      }
    } else {
      riskLevel = 'low';
      prediction = 'You are on track — strong chance of a productive tomorrow.';
      if (rate7 !== null) {
        reason = `${rate7}% task completion over 7 days${habits.length > 0 && !streakDeclining ? ' with stable habit consistency' : ''}.`;
      } else {
        reason = 'No significant risk signals detected in the last 7 days.';
      }
    }

    return res.json({
      riskLevel,
      prediction,
      reason,
      // Additional context for richer frontend display
      meta: {
        taskCompletionRate7d: rate7,
        taskCompletionRate3d: rate3,
        habitConsistencyEarlyWeek: habitRateFirst,
        habitConsistencyLateWeek: habitRateLast,
        streakDeclining,
        maxConsecutiveMisses,
        habitAtRisk: habitWithMostMisses,
        highPriorityAvoidance: avoidingHighPriority,
        activeSignals: signals,
        riskScore: Math.round(score * 100),
      },
    });
  } catch (err) {
    console.error('GET /insights/predictions error:', err);
    return res.status(500).json({ error: 'Failed to compute predictions.' });
  }
});

module.exports = router;

