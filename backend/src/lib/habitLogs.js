const { addDaysYmd } = require('./dates');

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

module.exports = { countDoneCalendarStreakFrom };
