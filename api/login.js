const { signToken, isValidAdminPassword } = require('./_lib/auth');
const { createLoginRateLimiter } = require('./_lib/loginRateLimit');

let defaultLimiter;
function getDefaultLimiter() {
  if (!defaultLimiter) defaultLimiter = createLoginRateLimiter();
  return defaultLimiter;
}

function applyBlockedResponse(res, retryAfterSeconds) {
  res.setHeader('Retry-After', String(retryAfterSeconds));
  return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
}

function createLoginHandler({ limiter } = {}) {
  return async function handler(req, res) {
    const effectiveLimiter = limiter || getDefaultLimiter();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const preCheck = await effectiveLimiter.check(req);
    if (!preCheck.allowed) return applyBlockedResponse(res, preCheck.retryAfterSeconds);

    const { password } = req.body || {};
    if (isValidAdminPassword(password)) {
      await effectiveLimiter.reset(req);
      return res.json({ token: signToken() });
    }

    const failureResult = await effectiveLimiter.recordFailure(req);
    if (!failureResult.allowed) return applyBlockedResponse(res, failureResult.retryAfterSeconds);
    return res.status(401).json({ error: 'Invalid password' });
  };
}

module.exports = createLoginHandler();
module.exports.createLoginHandler = createLoginHandler;
