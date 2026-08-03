const request = require('supertest');
const app = require('../src/app');
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

describe('POST /auth/register', () => {
  it('creates a user and sets an httpOnly session cookie', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'testpass123',
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com', xp: 0, level: 1 });
    expect(res.body.token).toBeUndefined(); // never leaks a bearer token

    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(setCookie[0]).toMatch(/uphill_session=/);
    expect(setCookie[0]).toMatch(/HttpOnly/i);
  });

  it('rejects a duplicate email', async () => {
    const body = { name: 'Ada', email: 'dup@example.com', password: 'testpass123' };
    await request(app).post('/auth/register').send(body);
    const res = await request(app).post('/auth/register').send(body);
    expect(res.status).toBe(409);
  });

  it('rejects a short password', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'Ada',
      email: 'short@example.com',
      password: '123',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a missing field', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'nofields@example.com' });
    expect(res.status).toBe(400);
  });

  it('rejects a malformed email address', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'Ada',
      email: 'not-an-email',
      password: 'testpass123',
    });
    expect(res.status).toBe(400);
  });

  it('trims name and lowercases email before storing', async () => {
    const res = await request(app).post('/auth/register').send({
      name: '  Ada Lovelace  ',
      email: '  ADA-CASE@Example.com  ',
      password: 'testpass123',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.name).toBe('Ada Lovelace');
    expect(res.body.user.email).toBe('ada-case@example.com');
  });
});

describe('POST /auth/login', () => {
  it('logs in with correct credentials', async () => {
    await request(app).post('/auth/register').send({ name: 'Ada', email: 'login@example.com', password: 'testpass123' });
    const res = await request(app).post('/auth/login').send({ email: 'login@example.com', password: 'testpass123' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('login@example.com');
  });

  it('rejects a wrong password', async () => {
    await request(app).post('/auth/register').send({ name: 'Ada', email: 'wrongpw@example.com', password: 'testpass123' });
    const res = await request(app).post('/auth/login').send({ email: 'wrongpw@example.com', password: 'nope12345' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown email', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'ghost@example.com', password: 'testpass123' });
    expect(res.status).toBe(401);
  });

  it('rejects a missing password with 400, not 401', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'someone@example.com' });
    expect(res.status).toBe(400);
  });
});

describe('GET /auth/me', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user when authenticated via cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/register').send({ name: 'Ada', email: 'me@example.com', password: 'testpass123' });
    const res = await agent.get('/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('me@example.com');
  });
});

describe('POST /auth/logout', () => {
  it('clears the session so /auth/me is unauthenticated afterward', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/register').send({ name: 'Ada', email: 'logout@example.com', password: 'testpass123' });
    expect((await agent.get('/auth/me')).status).toBe(200);

    await agent.post('/auth/logout');
    expect((await agent.get('/auth/me')).status).toBe(401);
  });
});
