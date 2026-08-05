const { addDaysYmd, parseYmdLocal } = require('./dates');

/** True if `ymd` falls on one of scheduledDays (0=Sun..6=Sat). An empty/missing
 * scheduledDays means "every day", preserving the original unscheduled behavior. */
function isScheduledDay(scheduledDays, ymd) {
  if (!scheduledDays || scheduledDays.length === 0) return true;
  return scheduledDays.includes(parseYmdLocal(ymd).getDay());
}

/** Consecutive *scheduled* calendar days with a `done` log, walking backward
 * from endYmd (inclusive). Non-scheduled days are skipped rather than treated
 * as a break, so a Mon/Wed/Fri habit isn't penalized for a quiet Tuesday. */
function countDoneCalendarStreakFrom(logs, endYmd, scheduledDays = []) {
  const map = new Map((logs || []).map((l) => [l.date, l.status]));
  let count = 0;
  let cur = endYmd;
  for (;;) {
    if (!isScheduledDay(scheduledDays, cur)) {
      cur = addDaysYmd(cur, -1);
      continue;
    }
    if (map.get(cur) === 'done') {
      count += 1;
      cur = addDaysYmd(cur, -1);
    } else {
      break;
    }
  }
  return count;
}

/** The most recent scheduled date strictly before `ymd`. With no schedule
 * restriction this is simply the previous calendar day. */
function previousScheduledDate(scheduledDays, ymd) {
  let cur = addDaysYmd(ymd, -1);
  if (!scheduledDays || scheduledDays.length === 0) return cur;
  for (let i = 0; i < 7; i += 1) {
    if (scheduledDays.includes(parseYmdLocal(cur).getDay())) return cur;
    cur = addDaysYmd(cur, -1);
  }
  return cur;
}

module.exports = { countDoneCalendarStreakFrom, isScheduledDay, previousScheduledDate };
