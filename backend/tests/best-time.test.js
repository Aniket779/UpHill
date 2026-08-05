const app = require('../src/app');
const Task = require('../src/models/Task');
const db = require('./helpers/db');
const { registerUser } = require('./helpers/auth');

beforeAll(async () => {
  await db.connect();
});

afterEach(async () => {
  await db.clearDatabase();
});

afterAll(async () => {
  await db.closeDatabase();
});

/** Directly inserts a completed task with a controlled completedAt timestamp,
 * bypassing the PATCH route (which always stamps "now") so bucket math is
 * deterministic regardless of when the test suite actually runs. */
async function seedCompletedTask(userId, { hour, priority = 'medium', category = 'general', date = '2026-01-01' }) {
  return Task.create({
    userId,
    title: `Task at ${hour}:00`,
    completed: true,
    completedAt: new Date(2026, 0, 1, hour, 0),
    priority,
    category,
    date,
    status: 'done',
  });
}

describe('GET /insights/best-time', () => {
  it('reports insufficientData with zero completions', async () => {
    const { agent } = await registerUser(app);
    const res = await agent.get('/insights/best-time');
    expect(res.status).toBe(200);
    expect(res.body.insufficientData).toBe(true);
    expect(res.body.sampleSize).toBe(0);
    expect(res.body.recommendation).toBeNull();
  });

  it('reports insufficientData below the minimum sample threshold', async () => {
    const { agent, user } = await registerUser(app);
    await seedCompletedTask(user.id, { hour: 9 });
    await seedCompletedTask(user.id, { hour: 9 });
    const res = await agent.get('/insights/best-time');
    expect(res.body.insufficientData).toBe(true);
    expect(res.body.sampleSize).toBe(2);
  });

  it('computes the dominant time bucket once enough data exists', async () => {
    const { agent, user } = await registerUser(app);
    for (let i = 0; i < 4; i += 1) await seedCompletedTask(user.id, { hour: 9 });
    await seedCompletedTask(user.id, { hour: 21 });

    const res = await agent.get('/insights/best-time');
    expect(res.body.insufficientData).toBe(false);
    expect(res.body.sampleSize).toBe(5);
    const top = res.body.buckets[0];
    expect(top.id).toBe('morning');
    expect(top.count).toBe(4);
    expect(res.body.recommendation).toMatch(/Morning/);
  });

  it('ignores incomplete tasks entirely', async () => {
    const { agent, user } = await registerUser(app);
    for (let i = 0; i < 5; i += 1) await seedCompletedTask(user.id, { hour: 9 });
    await Task.create({ userId: user.id, title: 'Not done', completed: false, date: '2026-01-01' });

    const res = await agent.get('/insights/best-time');
    expect(res.body.sampleSize).toBe(5);
  });

  it('filters by priority when there is enough scoped data', async () => {
    const { agent, user } = await registerUser(app);
    for (let i = 0; i < 5; i += 1) await seedCompletedTask(user.id, { hour: 9, priority: 'high' });
    for (let i = 0; i < 5; i += 1) await seedCompletedTask(user.id, { hour: 21, priority: 'low' });

    const res = await agent.get('/insights/best-time?priority=high');
    expect(res.body.insufficientData).toBe(false);
    expect(res.body.sampleSize).toBe(5);
    expect(res.body.usedFilter).toEqual({ priority: 'high', category: null });
    expect(res.body.buckets[0].id).toBe('morning');
  });

  it('falls back to the overall pattern when the filtered scope is too sparse', async () => {
    const { agent, user } = await registerUser(app);
    await seedCompletedTask(user.id, { hour: 9, priority: 'high' }); // only 1 high-priority sample
    for (let i = 0; i < 4; i += 1) await seedCompletedTask(user.id, { hour: 21, priority: 'low' });

    const res = await agent.get('/insights/best-time?priority=high');
    expect(res.body.insufficientData).toBe(false);
    expect(res.body.usedFilter).toBeNull();
    expect(res.body.sampleSize).toBe(5);
    expect(res.body.recommendation).toMatch(/overall/);
  });

  it('never leaks another user\'s completion data', async () => {
    const { agent: owner, user } = await registerUser(app);
    const { agent: intruder } = await registerUser(app);
    for (let i = 0; i < 5; i += 1) await seedCompletedTask(user.id, { hour: 9 });

    const res = await intruder.get('/insights/best-time');
    expect(res.body.insufficientData).toBe(true);
    expect(res.body.sampleSize).toBe(0);
    void owner;
  });
});
