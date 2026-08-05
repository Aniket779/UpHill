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

describe('Goal auto-progress from linked tasks', () => {
  it('increments progress when a linked task is completed', async () => {
    const { agent } = await registerUser(app);
    const goal = (await agent.post('/goals').send({ title: 'Ship v1', target: 5 })).body;
    const task = (await agent.post('/tasks').send({ title: 'Write docs', goalId: goal._id })).body;

    await agent.patch(`/tasks/${task._id}`).send({ completed: true });

    const goals = await agent.get('/goals');
    expect(goals.body.find((g) => g._id === goal._id).progress).toBe(1);
  });

  it('decrements progress when a linked task is uncompleted', async () => {
    const { agent } = await registerUser(app);
    const goal = (await agent.post('/goals').send({ title: 'Ship v1', target: 5 })).body;
    const task = (await agent.post('/tasks').send({ title: 'Write docs', goalId: goal._id })).body;
    await agent.patch(`/tasks/${task._id}`).send({ completed: true });

    await agent.patch(`/tasks/${task._id}`).send({ completed: false });

    const goals = await agent.get('/goals');
    expect(goals.body.find((g) => g._id === goal._id).progress).toBe(0);
  });

  it('clamps progress at target even with many linked tasks', async () => {
    const { agent } = await registerUser(app);
    const goal = (await agent.post('/goals').send({ title: 'Ship v1', target: 1 })).body;
    const t1 = (await agent.post('/tasks').send({ title: 'A', goalId: goal._id })).body;
    const t2 = (await agent.post('/tasks').send({ title: 'B', goalId: goal._id })).body;

    await agent.patch(`/tasks/${t1._id}`).send({ completed: true });
    await agent.patch(`/tasks/${t2._id}`).send({ completed: true });

    const goals = await agent.get('/goals');
    expect(goals.body.find((g) => g._id === goal._id).progress).toBe(1);
  });

  it('does not touch progress for a task with no goalId', async () => {
    const { agent } = await registerUser(app);
    const goal = (await agent.post('/goals').send({ title: 'Ship v1', target: 5, progress: 2 })).body;
    const task = (await agent.post('/tasks').send({ title: 'Unrelated' })).body;

    await agent.patch(`/tasks/${task._id}`).send({ completed: true });

    const goals = await agent.get('/goals');
    expect(goals.body.find((g) => g._id === goal._id).progress).toBe(2);
  });

  it('reverses goal progress when a completed linked task is deleted', async () => {
    const { agent } = await registerUser(app);
    const goal = (await agent.post('/goals').send({ title: 'Ship v1', target: 5 })).body;
    const task = (await agent.post('/tasks').send({ title: 'Write docs', goalId: goal._id })).body;
    await agent.patch(`/tasks/${task._id}`).send({ completed: true });

    await agent.delete(`/tasks/${task._id}`);

    const goals = await agent.get('/goals');
    expect(goals.body.find((g) => g._id === goal._id).progress).toBe(0);
  });
});

describe('Goal auto-progress from linked habits', () => {
  it('increments progress when a linked habit is logged done', async () => {
    const { agent } = await registerUser(app);
    const goal = (await agent.post('/goals').send({ title: 'Consistency', target: 5 })).body;
    const habit = (await agent.post('/habits').send({ name: 'Meditate', goalId: goal._id })).body;

    await agent.post(`/habits/${habit._id}/log`).send({ date: '2026-01-01', status: 'done' });

    const goals = await agent.get('/goals');
    expect(goals.body.find((g) => g._id === goal._id).progress).toBe(1);
  });

  it('decrements progress when a done habit log is changed to missed', async () => {
    const { agent } = await registerUser(app);
    const goal = (await agent.post('/goals').send({ title: 'Consistency', target: 5 })).body;
    const habit = (await agent.post('/habits').send({ name: 'Meditate', goalId: goal._id })).body;
    await agent.post(`/habits/${habit._id}/log`).send({ date: '2026-01-01', status: 'done' });

    await agent.post(`/habits/${habit._id}/log`).send({ date: '2026-01-01', status: 'missed' });

    const goals = await agent.get('/goals');
    expect(goals.body.find((g) => g._id === goal._id).progress).toBe(0);
  });
});

describe('Habit scheduledDays and schedule-aware streaks', () => {
  it('accepts and returns scheduledDays on creation', async () => {
    const { agent } = await registerUser(app);
    const habit = (await agent.post('/habits').send({ name: 'Gym', scheduledDays: [1, 3, 5] })).body;
    expect(habit.scheduledDays).toEqual([1, 3, 5]);
  });

  it('continues a streak across a non-scheduled gap day', async () => {
    const { agent } = await registerUser(app);
    // 2026-03-02 = Mon, 2026-03-04 = Wed — Tuesday is a gap but not scheduled.
    const habit = (await agent.post('/habits').send({ name: 'Gym', scheduledDays: [1, 3, 5] })).body;

    await agent.post(`/habits/${habit._id}/log`).send({ date: '2026-03-02', status: 'done' });
    const res = await agent.post(`/habits/${habit._id}/log`).send({ date: '2026-03-04', status: 'done' });

    expect(res.body.streak).toBe(2);
  });

  it('PATCH updates goalId and scheduledDays on an existing habit', async () => {
    const { agent } = await registerUser(app);
    const goal = (await agent.post('/goals').send({ title: 'Consistency', target: 5 })).body;
    const habit = (await agent.post('/habits').send({ name: 'Gym' })).body;

    const res = await agent.patch(`/habits/${habit._id}`).send({ goalId: goal._id, scheduledDays: [2, 4] });
    expect(res.body.goalId).toBe(goal._id);
    expect(res.body.scheduledDays).toEqual([2, 4]);
  });
});
