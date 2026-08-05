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

// 2026-03-02 = Monday, 2026-03-03 = Tuesday, 2026-03-04 = Wednesday,
// 2026-03-06 = Friday, 2026-03-09 = the following Monday.

describe('Recurring tasks (lazy materialization)', () => {
  it('materializes an instance on a matching scheduled day', async () => {
    const { agent } = await registerUser(app);
    const template = (
      await agent.post('/tasks').send({
        title: 'Gym',
        date: '2026-03-02',
        recurrence: { active: true, daysOfWeek: [1, 3, 5] }, // Mon/Wed/Fri
      })
    ).body;
    expect(template.recurrence.active).toBe(true);

    const wed = await agent.get('/tasks?date=2026-03-04');
    const instance = wed.body.find((t) => t.title === 'Gym');
    expect(instance).toBeDefined();
    expect(instance.recurringParentId).toBe(template._id);
    expect(instance.recurrence.active).toBe(false); // instances don't themselves recur
  });

  it('does not materialize on a non-scheduled day', async () => {
    const { agent } = await registerUser(app);
    await agent.post('/tasks').send({
      title: 'Gym',
      date: '2026-03-02',
      recurrence: { active: true, daysOfWeek: [1, 3, 5] },
    });

    const tue = await agent.get('/tasks?date=2026-03-03'); // Tuesday — not scheduled
    expect(tue.body.find((t) => t.title === 'Gym')).toBeUndefined();
  });

  it('materializes across week boundaries', async () => {
    const { agent } = await registerUser(app);
    await agent.post('/tasks').send({
      title: 'Gym',
      date: '2026-03-02',
      recurrence: { active: true, daysOfWeek: [1] }, // every Monday
    });

    const nextMonday = await agent.get('/tasks?date=2026-03-09');
    expect(nextMonday.body.find((t) => t.title === 'Gym')).toBeDefined();
  });

  it('is idempotent — refetching the same date does not create duplicates', async () => {
    const { agent } = await registerUser(app);
    await agent.post('/tasks').send({
      title: 'Gym',
      date: '2026-03-02',
      recurrence: { active: true, daysOfWeek: [1, 3, 5] },
    });

    await agent.get('/tasks?date=2026-03-04');
    const second = await agent.get('/tasks?date=2026-03-04');
    const matches = second.body.filter((t) => t.title === 'Gym');
    expect(matches.length).toBe(1);
  });

  it('respects an until date and stops generating instances after it', async () => {
    const { agent } = await registerUser(app);
    await agent.post('/tasks').send({
      title: 'Gym',
      date: '2026-03-02',
      recurrence: { active: true, daysOfWeek: [1, 3, 5], until: '2026-03-04' },
    });

    const fri = await agent.get('/tasks?date=2026-03-06'); // after the until date
    expect(fri.body.find((t) => t.title === 'Gym')).toBeUndefined();
  });

  it('a plain task with no recurrence never appears on other dates', async () => {
    const { agent } = await registerUser(app);
    await agent.post('/tasks').send({ title: 'One-off', date: '2026-03-02' });

    const wed = await agent.get('/tasks?date=2026-03-04');
    expect(wed.body.find((t) => t.title === 'One-off')).toBeUndefined();
  });

  it('completing a materialized instance does not affect the template or other instances', async () => {
    const { agent } = await registerUser(app);
    await agent.post('/tasks').send({
      title: 'Gym',
      date: '2026-03-02',
      recurrence: { active: true, daysOfWeek: [1, 3, 5] },
    });
    const wed = await agent.get('/tasks?date=2026-03-04');
    const instance = wed.body.find((t) => t.title === 'Gym');

    await agent.patch(`/tasks/${instance._id}`).send({ completed: true });

    const mon = await agent.get('/tasks?date=2026-03-02');
    const templateAfter = mon.body.find((t) => t.title === 'Gym');
    expect(templateAfter.completed).toBe(false);
  });
});
