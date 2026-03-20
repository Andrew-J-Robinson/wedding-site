const { verifyAuth, revokeToken } = require('./_lib/auth');

function getBearerToken(req) {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

function createLogoutHandler({ verify = verifyAuth, revoke = revokeToken } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      if (!(await verify(req))) return res.status(401).json({ error: 'Unauthorized' });
      const token = getBearerToken(req);
      if (!token) return res.status(401).json({ error: 'Unauthorized' });
      await revoke(token);
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: 'Authentication is not configured correctly.' });
    }
  };
}

module.exports = createLogoutHandler();
module.exports.createLogoutHandler = createLogoutHandler;
