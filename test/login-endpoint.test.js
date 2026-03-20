const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ADMIN_PASSWORD = 'correct-password';
process.env.JWT_SECRET = 'test-secret';

const { createLoginHandler } = require('../api/login');
const { createLoginRateLimiter } = require('../api/_lib/loginRateLimit');

function createMemoryStore() {
  const rows = new Map();
  return {
    async get(clientKey) {
      return rows.get(clientKey) || null;
    },
    async set(clientKey, state) {
      rows.set(clientKey, {
        client_key: clientKey,
        fail_count: state.failCount,
        window_started_at: state.windowStartedAt,
        blocked_until: state.blockedUntil,
        updated_at: state.updatedAt
      });
    },
    async clear(clientKey) {
      rows.delete(clientKey);
    }
  };
}

function createReq(password, ip = '198.51.100.8') {
  return {
    method: 'POST',
    body: { password },
    headers: {
      'x-forwarded-for': ip,
      'user-agent': 'endpoint-test-agent'
    },
    socket: {}
  };
}

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = String(value);
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test('invalid attempts are counted and eventually blocked', async () => {
  const nowMs = Date.parse('2026-03-20T12:00:00.000Z');
  const limiter = createLoginRateLimiter({
    store: createMemoryStore(),
    now: () => nowMs,
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000,
    lockoutMs: 15 * 60 * 1000
  });
  const handler = createLoginHandler({ limiter });

  for (let i = 0; i < 2; i += 1) {
    const res = createRes();
    await handler(createReq('wrong-password'), res);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'Invalid password' });
  }

  const blockedRes = createRes();
  await handler(createReq('wrong-password'), blockedRes);
  assert.equal(blockedRes.statusCode, 429);
  assert.equal(blockedRes.body.error, 'Too many login attempts. Try again later.');
  assert.equal(blockedRes.headers['Retry-After'], '900');
});

test('successful login resets state and returns token', async () => {
  let nowMs = Date.parse('2026-03-20T12:00:00.000Z');
  const limiter = createLoginRateLimiter({
    store: createMemoryStore(),
    now: () => nowMs,
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000,
    lockoutMs: 15 * 60 * 1000
  });
  const handler = createLoginHandler({ limiter });

  const failedRes = createRes();
  await handler(createReq('wrong-password', '198.51.100.9'), failedRes);
  assert.equal(failedRes.statusCode, 401);

  const successRes = createRes();
  await handler(createReq('correct-password', '198.51.100.9'), successRes);
  assert.equal(successRes.statusCode, 200);
  assert.equal(typeof successRes.body.token, 'string');

  nowMs += 1000;
  const nextFailedRes = createRes();
  await handler(createReq('wrong-password', '198.51.100.9'), nextFailedRes);
  assert.equal(nextFailedRes.statusCode, 401);
});
