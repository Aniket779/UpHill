/**
 * Shared local-date (YYYY-MM-DD) helpers. Previously reimplemented with
 * near-identical logic across tasks.js, habits.js, goals.js, insights.js,
 * reminders.js, agent.js, ai.js, and analytics.js — consolidated here so a
 * date-math fix (timezone/DST edge cases) only has to happen once.
 *
 * All functions operate on local time and plain YYYY-MM-DD strings, matching
 * how dates are stored throughout the app (Task.date, Habit logs, etc).
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toYmd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Today, as a local YYYY-MM-DD string. */
function todayLocalString() {
  return toYmd(new Date());
}

/** Parses a YYYY-MM-DD string into a local-time Date (midnight local). */
function parseYmdLocal(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Shifts a YYYY-MM-DD string by deltaDays (positive or negative), returning a new YYYY-MM-DD string. */
function addDaysYmd(ymd, deltaDays) {
  const dt = parseYmdLocal(ymd);
  dt.setDate(dt.getDate() + deltaDays);
  return toYmd(dt);
}

/** Today shifted back by daysBack (0 = today), as a YYYY-MM-DD string. */
function ymdOffset(daysBack) {
  return addDaysYmd(todayLocalString(), -daysBack);
}

/** The Monday of the week containing `ref` (defaults to today), local time. */
function weekStartMondayLocal(ref = new Date()) {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return toYmd(d);
}

/** The last n days (inclusive of today), oldest first, as YYYY-MM-DD strings. */
function lastNDayStrings(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    days.push(ymdOffset(i));
  }
  return days;
}

module.exports = {
  todayLocalString,
  parseYmdLocal,
  addDaysYmd,
  ymdOffset,
  weekStartMondayLocal,
  lastNDayStrings,
};
