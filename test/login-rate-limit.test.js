const test = require('node:test');
const assert = require('node:assert/strict');

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

function makeReq(ip = '203.0.113.10') {
  return {
    headers: {
      'x-forwarded-for': ip,
      'user-agent': 'test-agent'
    },
    socket: {}
  };
}

test('blocks after threshold and reports retry-after seconds', async () => {
  let currentMs = Date.parse('2026-03-20T12:00:00.000Z');
  const limiter = createLoginRateLimiter({
    store: createMemoryStore(),
    now: () => currentMs,
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000,
    lockoutMs: 15 * 60 * 1000
  });
  const req = makeReq();

  await limiter.recordFailure(req);
  await limiter.recordFailure(req);
  const third = await limiter.recordFailure(req);

  assert.equal(third.allowed, false);
  assert.equal(third.reason, 'blocked');
  assert.equal(third.retryAfterSeconds, 900);

  currentMs += 1000;
  const blockedCheck = await limiter.check(req);
  assert.equal(blockedCheck.allowed, false);
  assert.equal(blockedCheck.retryAfterSeconds, 899);
});

test('allows attempts again after lockout expires', async () => {
  let currentMs = Date.parse('2026-03-20T12:00:00.000Z');
  const limiter = createLoginRateLimiter({
    store: createMemoryStore(),
    now: () => currentMs,
    maxAttempts: 2,
    windowMs: 15 * 60 * 1000,
    lockoutMs: 60 * 1000
  });
  const req = makeReq();

  await limiter.recordFailure(req);
  await limiter.recordFailure(req);

  currentMs += 61 * 1000;
  const postLockCheck = await limiter.check(req);
  assert.equal(postLockCheck.allowed, true);
});

test('reset clears the failure state', async () => {
  const limiter = createLoginRateLimiter({
    store: createMemoryStore(),
    now: () => Date.parse('2026-03-20T12:00:00.000Z'),
    maxAttempts: 3
  });
  const req = makeReq();

  await limiter.recordFailure(req);
  await limiter.reset(req);

  const check = await limiter.check(req);
  assert.equal(check.allowed, true);
});
