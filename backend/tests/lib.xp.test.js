const { applyXpDelta, taskXpBase, HABIT_XP } = require('../src/lib/xp');
const User = require('../src/models/User');
const db = require('./helpers/db');

beforeAll(async () => {
  await db.connect();
});

afterEach(async () => {
  await db.clearDatabase();
});

afterAll(async () => {
  await db.closeDatabase();
});

async function makeUser(xp = 0) {
  const user = await User.create({ name: 'Test', email: `xp-${Date.now()}-${Math.random()}@example.com`, passwordHash: 'x', xp });
  return user;
}

describe('taskXpBase', () => {
  it('returns 50 for high priority', () => {
    expect(taskXpBase('high')).toBe(50);
  });
  it('returns 30 for medium priority', () => {
    expect(taskXpBase('medium')).toBe(30);
  });
  it('falls back to 10 (low) for anything else, matching the original ternary', () => {
    expect(taskXpBase('low')).toBe(10);
    expect(taskXpBase('garbage')).toBe(10);
    expect(taskXpBase(undefined)).toBe(10);
  });
});

describe('applyXpDelta', () => {
  it('increases xp and recomputes level', async () => {
    const user = await makeUser(0);
    const updated = await applyXpDelta({ io: null, userId: user._id, delta: 50, message: 'test' });
    expect(updated.xp).toBe(50);
    expect(updated.level).toBe(1); // level = floor(xp/100) + 1

    const persisted = await User.findById(user._id).lean();
    expect(persisted.xp).toBe(50);
  });

  it('levels up once xp crosses a 100-point boundary', async () => {
    const user = await makeUser(90);
    const updated = await applyXpDelta({ io: null, userId: user._id, delta: 20, message: 'test' });
    expect(updated.xp).toBe(110);
    expect(updated.level).toBe(2);
  });

  it('never lets xp go negative', async () => {
    const user = await makeUser(10);
    const updated = await applyXpDelta({ io: null, userId: user._id, delta: -50, message: 'test' });
    expect(updated.xp).toBe(0);
    expect(updated.level).toBe(1);
  });

  it('is a no-op when delta is 0', async () => {
    const user = await makeUser(42);
    const result = await applyXpDelta({ io: null, userId: user._id, delta: 0, message: 'test' });
    expect(result).toBeNull();

    const persisted = await User.findById(user._id).lean();
    expect(persisted.xp).toBe(42); // untouched
  });

  it('returns null for a user that does not exist', async () => {
    const fakeId = '000000000000000000000000';
    const result = await applyXpDelta({ io: null, userId: fakeId, delta: 10, message: 'test' });
    expect(result).toBeNull();
  });

  it('emits xp:updated to the correct per-user room when io is provided', async () => {
    const user = await makeUser(0);
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    const io = { to };

    await applyXpDelta({ io, userId: user._id, delta: 20, message: 'Completed habit (+20 XP)' });

    expect(to).toHaveBeenCalledWith(`user:${user._id}`);
    expect(emit).toHaveBeenCalledWith('xp:updated', {
      xp: 20,
      level: 1,
      delta: 20,
      message: 'Completed habit (+20 XP)',
    });
  });

  it('HABIT_XP is 20, matching the documented habit XP award', () => {
    expect(HABIT_XP).toBe(20);
  });
});
