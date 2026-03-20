const test = require('node:test');
const assert = require('node:assert/strict');

const { createAuthService } = require('../api/_lib/auth');

function createMemoryRevocationStore() {
  const revoked = new Set();
  return {
    async isRevoked(jti) {
      return revoked.has(jti);
    },
    async revoke(jti) {
      revoked.add(jti);
    }
  };
}

function makeAuthHeader(token) {
  return {
    headers: { authorization: `Bearer ${token}` }
  };
}

test('signToken + verifyAuth works with strict claims', async () => {
  const auth = createAuthService({
    env: { JWT_SECRET: 'secret', ADMIN_PASSWORD: 'password' },
    revocationStore: createMemoryRevocationStore(),
    randomUUID: () => 'token-jti-1'
  });

  const token = auth.signToken();
  const ok = await auth.verifyAuth(makeAuthHeader(token));
  assert.equal(ok, true);
});

test('verifyAuth rejects revoked tokens', async () => {
  const store = createMemoryRevocationStore();
  const auth = createAuthService({
    env: { JWT_SECRET: 'secret', ADMIN_PASSWORD: 'password' },
    revocationStore: store,
    randomUUID: () => 'token-jti-2'
  });

  const token = auth.signToken();
  await auth.revokeToken(token);
  const ok = await auth.verifyAuth(makeAuthHeader(token));
  assert.equal(ok, false);
});

test('revokeToken invalidates a previously valid token', async () => {
  const store = createMemoryRevocationStore();
  const auth = createAuthService({
    env: { JWT_SECRET: 'secret', ADMIN_PASSWORD: 'password' },
    revocationStore: store,
    randomUUID: () => 'token-jti-3'
  });

  const token = auth.signToken();
  assert.equal(await auth.verifyAuth(makeAuthHeader(token)), true);
  await auth.revokeToken(token);
  assert.equal(await auth.verifyAuth(makeAuthHeader(token)), false);
});

test('missing required env throws for signing and password checks', () => {
  const auth = createAuthService({
    env: {},
    revocationStore: createMemoryRevocationStore()
  });

  assert.throws(() => auth.signToken(), /Missing required environment variable/);
  assert.throws(() => auth.isValidAdminPassword('x'), /Missing required environment variable/);
});
