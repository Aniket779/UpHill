const { BUCKETS, bucketForHour, bucketCompletions } = require('../src/lib/timeBuckets');

describe('bucketForHour', () => {
  it('covers every hour of the day exactly once', () => {
    for (let h = 0; h < 24; h += 1) {
      const bucket = bucketForHour(h);
      expect(bucket).toBeDefined();
      expect(h).toBeGreaterThanOrEqual(bucket.startHour);
      expect(h).toBeLessThan(bucket.endHour);
    }
  });

  it('maps boundary hours to the correct bucket', () => {
    expect(bucketForHour(0).id).toBe('late_night');
    expect(bucketForHour(4).id).toBe('late_night');
    expect(bucketForHour(5).id).toBe('early_morning');
    expect(bucketForHour(8).id).toBe('morning');
    expect(bucketForHour(10).id).toBe('morning');
    expect(bucketForHour(11).id).toBe('midday');
    expect(bucketForHour(14).id).toBe('afternoon');
    expect(bucketForHour(17).id).toBe('evening');
    expect(bucketForHour(20).id).toBe('night');
    expect(bucketForHour(23).id).toBe('night');
  });
});

describe('bucketCompletions', () => {
  it('returns all buckets with zero counts for an empty list', () => {
    const result = bucketCompletions([]);
    expect(result).toHaveLength(BUCKETS.length);
    expect(result.every((b) => b.count === 0 && b.pct === 0)).toBe(true);
  });

  it('counts and computes percentages correctly, sorted by count descending', () => {
    const dates = [
      new Date(2026, 0, 1, 9, 0), // morning
      new Date(2026, 0, 2, 9, 30), // morning
      new Date(2026, 0, 3, 9, 45), // morning
      new Date(2026, 0, 4, 21, 0), // night
    ];
    const result = bucketCompletions(dates);
    expect(result[0].id).toBe('morning');
    expect(result[0].count).toBe(3);
    expect(result[0].pct).toBe(75);
    const night = result.find((b) => b.id === 'night');
    expect(night.count).toBe(1);
    expect(night.pct).toBe(25);
  });

  it('every bucket sums to the total input count', () => {
    const dates = [new Date(2026, 0, 1, 3), new Date(2026, 0, 1, 13), new Date(2026, 0, 1, 23)];
    const result = bucketCompletions(dates);
    const total = result.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(dates.length);
  });
});
