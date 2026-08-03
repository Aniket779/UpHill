const request = require('supertest');
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

describe('Tasks: ownership scoping', () => {
  it('creates a task owned by the authenticated user', async () => {
    const { agent, user } = await registerUser(app);
    const res = await agent.post('/tasks').send({ title: 'My task', priority: 'high' });
    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(user.id);
  });

  it("never returns another user's tasks from list/board endpoints", async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);

    await a.agent.post('/tasks').send({ title: 'A task' });
    await b.agent.post('/tasks').send({ title: 'B task' });

    const bTasks = await b.agent.get('/tasks?date=today');
    expect(bTasks.body.map((t) => t.title)).toEqual(['B task']);

    const bBoard = await b.agent.get('/tasks/board');
    expect(bBoard.body.map((t) => t.title)).toEqual(['B task']);
  });

  it("404s when a user tries to PATCH another user's task", async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);

    const created = await a.agent.post('/tasks').send({ title: 'A task' });
    const res = await b.agent.patch(`/tasks/${created.body._id}`).send({ completed: true });

    expect(res.status).toBe(404);

    // and it's genuinely untouched
    const stillOpen = await a.agent.get('/tasks?date=today');
    expect(stillOpen.body[0].completed).toBe(false);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/tasks?date=today');
    expect(res.status).toBe(401);
  });
});

describe('Habits: ownership scoping', () => {
  it("404s when a user tries to log another user's habit", async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);

    const habit = await a.agent.post('/habits').send({ name: 'A habit' });
    const res = await b.agent.post(`/habits/${habit.body._id}/log`).send({ status: 'done' });

    expect(res.status).toBe(404);
  });

  it("never returns another user's habits", async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);

    await a.agent.post('/habits').send({ name: 'A habit' });
    await b.agent.post('/habits').send({ name: 'B habit' });

    const bHabits = await b.agent.get('/habits');
    expect(bHabits.body.map((h) => h.name)).toEqual(['B habit']);

    const bStreaks = await b.agent.get('/habits/streaks');
    expect(bStreaks.body.map((h) => h.name)).toEqual(['B habit']);
  });
});

describe('Goals: ownership scoping', () => {
  it("404s when a user tries to PATCH another user's goal", async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);

    const goal = await a.agent.post('/goals').send({ title: 'A goal', target: 10 });
    const res = await b.agent.patch(`/goals/${goal.body._id}`).send({ progress: 5 });

    expect(res.status).toBe(404);
  });

  it("never returns another user's goals", async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);

    await a.agent.post('/goals').send({ title: 'A goal' });
    await b.agent.post('/goals').send({ title: 'B goal' });

    const bGoals = await b.agent.get('/goals');
    expect(bGoals.body.map((g) => g.title)).toEqual(['B goal']);
  });
});

describe('Analytics and insights: scoped to the current user', () => {
  it("analytics summary reflects only the caller's own tasks", async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);

    await a.agent.post('/tasks').send({ title: 'A task 1' });
    await a.agent.post('/tasks').send({ title: 'A task 2' });
    await b.agent.post('/tasks').send({ title: 'B task' });

    const aSummary = await a.agent.get('/analytics/summary');
    const bSummary = await b.agent.get('/analytics/summary');

    expect(aSummary.body.totalTasks).toBe(2);
    expect(bSummary.body.totalTasks).toBe(1);
  });

  it("notifications never reference another user's data", async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);

    await a.agent.post('/goals').send({ title: 'Ship the launch' });

    const bNotifications = await b.agent.get('/notifications');
    const mentionsA = bNotifications.body.some((n) => n.message.includes('Ship the launch'));
    expect(mentionsA).toBe(false);
  });
});
