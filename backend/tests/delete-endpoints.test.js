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

describe('DELETE /tasks/:id', () => {
  it('deletes a task the user owns and it no longer appears in listings', async () => {
    const { agent } = await registerUser(app);
    const task = (await agent.post('/tasks').send({ title: 'Throwaway', date: '2026-03-01' })).body;

    const del = await agent.delete(`/tasks/${task._id}`);
    expect(del.status).toBe(204);

    const list = await agent.get('/tasks?date=2026-03-01');
    expect(list.body.find((t) => t._id === task._id)).toBeUndefined();
  });

  it('reverses XP when deleting a completed task', async () => {
    const { agent } = await registerUser(app);
    const task = (await agent.post('/tasks').send({ title: 'Ship it', priority: 'high' })).body;
    await agent.patch(`/tasks/${task._id}`).send({ completed: true });
    expect((await agent.get('/auth/me')).body.xp).toBe(50);

    await agent.delete(`/tasks/${task._id}`);
    expect((await agent.get('/auth/me')).body.xp).toBe(0);
  });

  it('does not reverse XP when deleting an incomplete task', async () => {
    const { agent } = await registerUser(app);
    const other = (await agent.post('/tasks').send({ title: 'Keep me', priority: 'high' })).body;
    await agent.patch(`/tasks/${other._id}`).send({ completed: true });

    const task = (await agent.post('/tasks').send({ title: 'Never done', priority: 'high' })).body;
    await agent.delete(`/tasks/${task._id}`);

    expect((await agent.get('/auth/me')).body.xp).toBe(50);
  });

  it('returns 404 for a task belonging to another user', async () => {
    const { agent: owner } = await registerUser(app);
    const { agent: intruder } = await registerUser(app);
    const task = (await owner.post('/tasks').send({ title: 'Private' })).body;

    const res = await intruder.delete(`/tasks/${task._id}`);
    expect(res.status).toBe(404);

    const stillThere = await owner.get(`/tasks?date=${task.date}`);
    expect(stillThere.body.find((t) => t._id === task._id)).toBeDefined();
  });

  it('returns 404 for a nonexistent task id', async () => {
    const { agent } = await registerUser(app);
    const res = await agent.delete('/tasks/507f1f77bcf86cd799439011');
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed task id', async () => {
    const { agent } = await registerUser(app);
    const res = await agent.delete('/tasks/not-an-id');
    expect(res.status).toBe(400);
  });
});

describe('DELETE /habits/:id', () => {
  it('deletes a habit the user owns and it no longer appears in listings', async () => {
    const { agent } = await registerUser(app);
    const habit = (await agent.post('/habits').send({ name: 'Gym' })).body;

    const del = await agent.delete(`/habits/${habit._id}`);
    expect(del.status).toBe(204);

    const list = await agent.get('/habits');
    expect(list.body.find((h) => h._id === habit._id)).toBeUndefined();
  });

  it('returns 404 for a habit belonging to another user', async () => {
    const { agent: owner } = await registerUser(app);
    const { agent: intruder } = await registerUser(app);
    const habit = (await owner.post('/habits').send({ name: 'Private habit' })).body;

    const res = await intruder.delete(`/habits/${habit._id}`);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /goals/:id', () => {
  it('deletes a goal the user owns and it no longer appears in listings', async () => {
    const { agent } = await registerUser(app);
    const goal = (await agent.post('/goals').send({ title: 'Ship v1', target: 10 })).body;

    const del = await agent.delete(`/goals/${goal._id}`);
    expect(del.status).toBe(204);

    const list = await agent.get('/goals');
    expect(list.body.find((g) => g._id === goal._id)).toBeUndefined();
  });

  it('returns 404 for a goal belonging to another user', async () => {
    const { agent: owner } = await registerUser(app);
    const { agent: intruder } = await registerUser(app);
    const goal = (await owner.post('/goals').send({ title: 'Private goal' })).body;

    const res = await intruder.delete(`/goals/${goal._id}`);
    expect(res.status).toBe(404);
  });

  it('clears goalId on tasks and habits that were linked to the deleted goal', async () => {
    const { agent } = await registerUser(app);
    const goal = (await agent.post('/goals').send({ title: 'Ship v1', target: 10 })).body;
    const task = (await agent.post('/tasks').send({ title: 'Linked task', goalId: goal._id })).body;
    const habit = (await agent.post('/habits').send({ name: 'Linked habit', goalId: goal._id })).body;
    expect(task.goalId).toBe(goal._id);
    expect(habit.goalId).toBe(goal._id);

    await agent.delete(`/goals/${goal._id}`);

    const tasks = await agent.get(`/tasks?date=${task.date}`);
    const habits = await agent.get('/habits');
    expect(tasks.body.find((t) => t._id === task._id).goalId).toBeNull();
    expect(habits.body.find((h) => h._id === habit._id).goalId).toBeNull();
  });
});
