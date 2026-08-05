/**
 * Buckets a local hour-of-day (0-23) into a named time-of-day window. Used to
 * turn Task.completedAt timestamps into a "when do you actually get things
 * done" distribution — a plain histogram + mode, not a model, so it stays
 * fast, free, and testable without calling the AI at all.
 */
const BUCKETS = [
  { id: 'late_night', label: 'Late Night', range: '12–5 AM', startHour: 0, endHour: 5 },
  { id: 'early_morning', label: 'Early Morning', range: '5–8 AM', startHour: 5, endHour: 8 },
  { id: 'morning', label: 'Morning', range: '8–11 AM', startHour: 8, endHour: 11 },
  { id: 'midday', label: 'Midday', range: '11 AM–2 PM', startHour: 11, endHour: 14 },
  { id: 'afternoon', label: 'Afternoon', range: '2–5 PM', startHour: 14, endHour: 17 },
  { id: 'evening', label: 'Evening', range: '5–8 PM', startHour: 17, endHour: 20 },
  { id: 'night', label: 'Night', range: '8 PM–12 AM', startHour: 20, endHour: 24 },
];

function bucketForHour(hour) {
  return BUCKETS.find((b) => hour >= b.startHour && hour < b.endHour) || BUCKETS[0];
}

/** Given an array of Date objects, returns each bucket with its count and
 * percentage share, sorted by count descending. */
function bucketCompletions(dates) {
  const counts = new Map(BUCKETS.map((b) => [b.id, 0]));
  for (const d of dates) {
    const bucket = bucketForHour(d.getHours());
    counts.set(bucket.id, counts.get(bucket.id) + 1);
  }
  const total = dates.length;
  return BUCKETS.map((b) => {
    const count = counts.get(b.id);
    return {
      id: b.id,
      label: b.label,
      range: b.range,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  }).sort((a, b) => b.count - a.count);
}

module.exports = { BUCKETS, bucketForHour, bucketCompletions };
