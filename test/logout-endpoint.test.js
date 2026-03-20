const test = require('node:test');
const assert = require('node:assert/strict');

const { createLogoutHandler } = require('../api/logout');

function createReq({ method = 'POST', token } = {}) {
  return {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {}
  };
}

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test('rejects non-POST requests', async () => {
  const handler = createLogoutHandler({
    verify: async () => true,
    revoke: async () => {}
  });
  const res = createRes();
  await handler(createReq({ method: 'GET' }), res);
  assert.equal(res.statusCode, 405);
});

test('returns unauthorized for unauthenticated requests', async () => {
  const handler = createLogoutHandler({
    verify: async () => false,
    revoke: async () => {}
  });
  const res = createRes();
  await handler(createReq({ token: 'abc' }), res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'Unauthorized' });
});

test('revokes bearer token when authenticated', async () => {
  let revokedToken = null;
  const handler = createLogoutHandler({
    verify: async () => true,
    revoke: async (token) => {
      revokedToken = token;
    }
  });
  const res = createRes();
  await handler(createReq({ token: 'jwt.token.value' }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(revokedToken, 'jwt.token.value');
});
