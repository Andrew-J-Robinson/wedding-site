const crypto = require('crypto');

const RATE_LIMITS_TABLE = 'login_rate_limits';

const DEFAULT_OPTIONS = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  lockoutMs: 15 * 60 * 1000
};

function getClientIp(req) {
  const forwardedFor = req?.headers?.['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return req?.socket?.remoteAddress || 'unknown';
}

function getClientKey(req) {
  const ip = getClientIp(req);
  const userAgent = String(req?.headers?.['user-agent'] || '');
  const userAgentHash = crypto.createHash('sha256').update(userAgent).digest('hex').slice(0, 16);
  return `${ip}:${userAgentHash}`;
}

function secondsUntil(ts, nowMs) {
  return Math.max(0, Math.ceil((new Date(ts).getTime() - nowMs) / 1000));
}

function createSupabaseStore(client) {
  const effectiveClient = client || require('./supabase');
  return {
    async get(clientKey) {
      const { data, error, status } = await effectiveClient
        .from(RATE_LIMITS_TABLE)
        .select('*')
        .eq('client_key', clientKey)
        .maybeSingle();
      if (error && status !== 406) throw error;
      return data || null;
    },
    async set(clientKey, state) {
      const payload = {
        client_key: clientKey,
        fail_count: state.failCount,
        window_started_at: state.windowStartedAt,
        blocked_until: state.blockedUntil,
        updated_at: state.updatedAt
      };
      const { error } = await effectiveClient.from(RATE_LIMITS_TABLE).upsert(payload);
      if (error) throw error;
    },
    async clear(clientKey) {
      const { error } = await effectiveClient.from(RATE_LIMITS_TABLE).delete().eq('client_key', clientKey);
      if (error) throw error;
    }
  };
}

function createLoginRateLimiter({
  store = createSupabaseStore(),
  now = () => Date.now(),
  maxAttempts = DEFAULT_OPTIONS.maxAttempts,
  windowMs = DEFAULT_OPTIONS.windowMs,
  lockoutMs = DEFAULT_OPTIONS.lockoutMs
} = {}) {
  async function check(req) {
    const clientKey = getClientKey(req);
    const record = await store.get(clientKey);
    const nowMs = now();

    if (record?.blocked_until && new Date(record.blocked_until).getTime() > nowMs) {
      return {
        allowed: false,
        reason: 'blocked',
        retryAfterSeconds: secondsUntil(record.blocked_until, nowMs)
      };
    }

    return { allowed: true, reason: 'ok', retryAfterSeconds: 0 };
  }

  async function recordFailure(req) {
    const clientKey = getClientKey(req);
    const nowMs = now();
    const nowIso = new Date(nowMs).toISOString();
    const record = await store.get(clientKey);

    if (record?.blocked_until && new Date(record.blocked_until).getTime() > nowMs) {
      return {
        allowed: false,
        reason: 'blocked',
        retryAfterSeconds: secondsUntil(record.blocked_until, nowMs)
      };
    }

    const currentWindowStartMs = record?.window_started_at ? new Date(record.window_started_at).getTime() : 0;
    const windowExpired = !record || nowMs - currentWindowStartMs > windowMs;
    const failCount = windowExpired ? 1 : (record.fail_count || 0) + 1;
    const blocked = failCount >= maxAttempts;
    const blockedUntilIso = blocked ? new Date(nowMs + lockoutMs).toISOString() : null;

    await store.set(clientKey, {
      failCount,
      windowStartedAt: windowExpired ? nowIso : record.window_started_at,
      blockedUntil: blockedUntilIso,
      updatedAt: nowIso
    });

    if (blocked) {
      return {
        allowed: false,
        reason: 'blocked',
        retryAfterSeconds: secondsUntil(blockedUntilIso, nowMs)
      };
    }

    return { allowed: true, reason: 'invalid_password', retryAfterSeconds: 0 };
  }

  async function reset(req) {
    const clientKey = getClientKey(req);
    await store.clear(clientKey);
  }

  return { check, recordFailure, reset };
}

module.exports = {
  createLoginRateLimiter,
  createSupabaseStore,
  getClientKey
};
