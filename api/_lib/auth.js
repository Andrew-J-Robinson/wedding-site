const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function signToken() {
  return jwt.sign({ role: 'admin' }, SECRET, { expiresIn: '7d' });
}

function isValidAdminPassword(password) {
  return password === ADMIN_PASSWORD;
}

function verifyAuth(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return false;
  try {
    jwt.verify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

module.exports = { signToken, verifyAuth, isValidAdminPassword };
