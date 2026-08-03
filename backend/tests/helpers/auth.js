const request = require('supertest');

let counter = 0;

/**
 * Registers a fresh user against a supertest agent (which persists the
 * session cookie automatically across subsequent requests on that agent).
 * Returns the created user object.
 */
async function registerUser(app, overrides = {}) {
  counter += 1;
  const agent = request.agent(app);
  const body = {
    name: overrides.name ?? `Test User ${counter}`,
    email: overrides.email ?? `test-user-${counter}-${Date.now()}@example.com`,
    password: overrides.password ?? 'testpass123',
  };
  const res = await agent.post('/auth/register').send(body);
  if (res.status !== 201) {
    throw new Error(`registerUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { agent, user: res.body.user, credentials: body };
}

module.exports = { registerUser };
