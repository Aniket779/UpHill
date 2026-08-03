const app = require('../src/app');
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

async function logHabit(agent, habitId, date, status) {
  return agent.post(`/habits/${habitId}/log`).send({ date, status });
}

describe('Habit streak calculation', () => {
  it('starts a fresh streak at 1 on the first done day', async () => {
    const { agent } = await registerUser(app);
    const habit = (await agent.post('/habits').send({ name: 'Gym' })).body;

    const res = await logHabit(agent, habit._id, '2026-01-01', 'done');
    expect(res.body.streak).toBe(1);
  });

  it('increments the streak on consecutive done days', async () => {
    const { agent } = await registerUser(app);
    const habit = (await agent.post('/habits').send({ name: 'Gym' })).body;

    await logHabit(agent, habit._id, '2026-01-01', 'done');
    await logHabit(agent, habit._id, '2026-01-02', 'done');
    const res = await logHabit(agent, habit._id, '2026-01-03', 'done');

    expect(res.body.streak).toBe(3);
  });

  it('correctly carries a streak across a month boundary', async () => {
    const { agent } = await registerUser(app);
    const habit = (await agent.post('/habits').send({ name: 'Gym' })).body;

    await logHabit(agent, habit._id, '2026-01-30', 'done');
    const res = await logHabit(agent, habit._id, '2026-01-31', 'done');

    // 2026 is not a leap year at Jan/Feb boundary in this sense (irrelevant),
    // but the real check is Jan 31 -> Feb 1 crossing a month.
    await logHabit(agent, habit._id, '2026-01-31', 'done');
    const crossed = await logHabit(agent, habit._id, '2026-02-01', 'done');

    expect(res.body.streak).toBe(2);
    expect(crossed.body.streak).toBe(3);
  });

  it('resets the streak to 0 on a missed day', async () => {
    const { agent } = await registerUser(app);
    const habit = (await agent.post('/habits').send({ name: 'Gym' })).body;

    await logHabit(agent, habit._id, '2026-01-01', 'done');
    await logHabit(agent, habit._id, '2026-01-02', 'done');
    const res = await logHabit(agent, habit._id, '2026-01-03', 'missed');

    expect(res.body.streak).toBe(0);
  });

  it('restarts the streak at 1 the day after a miss (does not resume the old count)', async () => {
    const { agent } = await registerUser(app);
    const habit = (await agent.post('/habits').send({ name: 'Gym' })).body;

    await logHabit(agent, habit._id, '2026-01-01', 'done');
    await logHabit(agent, habit._id, '2026-01-02', 'done');
    await logHabit(agent, habit._id, '2026-01-03', 'missed');
    const res = await logHabit(agent, habit._id, '2026-01-04', 'done');

    expect(res.body.streak).toBe(1);
  });

  it('does not double-increment when re-logging the same day as done', async () => {
    const { agent } = await registerUser(app);
    const habit = (await agent.post('/habits').send({ name: 'Gym' })).body;

    await logHabit(agent, habit._id, '2026-01-01', 'done');
    await logHabit(agent, habit._id, '2026-01-02', 'done');
    const first = await logHabit(agent, habit._id, '2026-01-02', 'done'); // re-log same day

    expect(first.body.streak).toBe(2); // unchanged, not 3
  });

  it('treats a gap (no log at all) the same as a miss for the next done day', async () => {
    const { agent } = await registerUser(app);
    const habit = (await agent.post('/habits').send({ name: 'Gym' })).body;

    await logHabit(agent, habit._id, '2026-01-01', 'done');
    // no log for 2026-01-02 at all — a gap
    const res = await logHabit(agent, habit._id, '2026-01-03', 'done');

    expect(res.body.streak).toBe(1);
  });
});

describe('XP awarding', () => {
  it('awards XP for completing a high-priority task and level reflects it', async () => {
    const { agent } = await registerUser(app);
    const task = (await agent.post('/tasks').send({ title: 'Ship it', priority: 'high' })).body;

    const res = await agent.patch(`/tasks/${task._id}`).send({ completed: true });
    expect(res.status).toBe(200);

    const me = await agent.get('/auth/me');
    expect(me.body.xp).toBe(50);
  });

  it('reverses XP when a completed task is marked incomplete again', async () => {
    const { agent } = await registerUser(app);
    const task = (await agent.post('/tasks').send({ title: 'Ship it', priority: 'medium' })).body;

    await agent.patch(`/tasks/${task._id}`).send({ completed: true });
    await agent.patch(`/tasks/${task._id}`).send({ completed: false });

    const me = await agent.get('/auth/me');
    expect(me.body.xp).toBe(0);
  });

  it('awards 20 XP for a completed habit and reverses it on a later miss', async () => {
    const { agent } = await registerUser(app);
    const habit = (await agent.post('/habits').send({ name: 'Gym' })).body;

    await logHabit(agent, habit._id, '2026-01-01', 'done');
    expect((await agent.get('/auth/me')).body.xp).toBe(20);

    await logHabit(agent, habit._id, '2026-01-01', 'missed');
    expect((await agent.get('/auth/me')).body.xp).toBe(0);
  });

  it('never lets XP go negative', async () => {
    const { agent } = await registerUser(app);
    const task = (await agent.post('/tasks').send({ title: 'Odd job', priority: 'low' })).body;

    // Mark incomplete when it's already incomplete — no XP change should occur,
    // and XP must never dip below 0 regardless.
    await agent.patch(`/tasks/${task._id}`).send({ completed: false, category: 'general' });
    const me = await agent.get('/auth/me');
    expect(me.body.xp).toBeGreaterThanOrEqual(0);
  });
});

describe('Goal progress clamping', () => {
  it('clamps progress to target on creation', async () => {
    const { agent } = await registerUser(app);
    const res = await agent.post('/goals').send({ title: 'Read books', target: 10, progress: 9999 });
    expect(res.body.progress).toBe(10);
  });

  it('clamps progress to target on a PATCH that only updates progress', async () => {
    const { agent } = await registerUser(app);
    const goal = (await agent.post('/goals').send({ title: 'Read books', target: 10 })).body;

    const res = await agent.patch(`/goals/${goal._id}`).send({ progress: 500 });
    expect(res.body.progress).toBe(10);
  });

  it('pulls existing progress back in line when target shrinks below it', async () => {
    const { agent } = await registerUser(app);
    const goal = (await agent.post('/goals').send({ title: 'Read books', target: 100, progress: 80 })).body;

    const res = await agent.patch(`/goals/${goal._id}`).send({ target: 50 });
    expect(res.body.target).toBe(50);
    expect(res.body.progress).toBe(50);
  });

  it('never allows negative progress', async () => {
    const { agent } = await registerUser(app);
    const res = await agent.post('/goals').send({ title: 'Read books', target: 10, progress: -5 });
    expect(res.body.progress).toBe(0);
  });
});
