const { signToken, isValidAdminPassword } = require('./_lib/auth');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};
  if (isValidAdminPassword(password)) {
    return res.json({ token: signToken() });
  }
  return res.status(401).json({ error: 'Invalid password' });
};
