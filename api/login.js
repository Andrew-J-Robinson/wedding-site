const { signToken } = require('./_lib/auth');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

module.exports = function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    return res.json({ token: signToken() });
  }
  return res.status(401).json({ error: 'Invalid password' });
};
