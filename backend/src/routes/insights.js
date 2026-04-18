const express = require('express');
const Habit = require('../models/Habit');

const router = express.Router();

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

module.exports = router;
