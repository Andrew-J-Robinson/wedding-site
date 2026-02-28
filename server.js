const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Fuse = require('fuse.js');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const inviteesPath = path.join(__dirname, 'data', 'invitees.json');
const rsvpsPath = path.join(__dirname, 'data', 'rsvps.json');
const sessionTokens = new Set();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const readJson = async (filePath, fallback = []) => {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
};

const writeJson = async (filePath, payload) => {
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
  await fs.rename(tempPath, filePath);
};

const requireAuth = (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token && sessionTokens.has(token)) return next();
  return res.status(401).json({ error: 'Unauthorized' });
};

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    const token = nanoid();
    sessionTokens.add(token);
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Invalid password' });
});

app.post('/api/invitees', requireAuth, async (req, res) => {
  const list = req.body || [];
  if (!Array.isArray(list)) return res.status(400).json({ error: 'Invitee list must be an array' });

  const normalized = list
    .map((item) => {
      if (!item || !item.name) return null;
      return {
        id: item.id || nanoid(),
        name: String(item.name).trim(),
        party: item.party || 1,
        contact: item.contact || '',
      };
    })
    .filter(Boolean);

  await writeJson(inviteesPath, normalized);
  res.json({ count: normalized.length });
});

app.get('/api/invitees/search', async (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name required' });

  const invitees = await readJson(inviteesPath, []);
  const fuse = new Fuse(invitees, { keys: ['name'], threshold: 0.4, includeScore: true });
  const results = fuse.search(name).map((r) => r.item).slice(0, 8);
  res.json({ results });
});

app.post('/api/rsvp', async (req, res) => {
  const { name, guestId, rsvp, allergies = '', note = '' } = req.body || {};
  if (!name || !rsvp) return res.status(400).json({ error: 'Name and RSVP status are required' });

  const record = {
    id: nanoid(),
    guestId: guestId || null,
    name: String(name).trim(),
    rsvp: rsvp.toLowerCase(),
    allergies: String(allergies || '').trim(),
    note: String(note || '').trim(),
    createdAt: new Date().toISOString(),
  };

  const existing = await readJson(rsvpsPath, []);
  existing.push(record);
  await writeJson(rsvpsPath, existing);
  res.json({ ok: true, id: record.id });
});

app.get('/api/rsvps', requireAuth, async (_req, res) => {
  const data = await readJson(rsvpsPath, []);
  res.json({ results: data });
});

// Serve page routes explicitly for clean URLs
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/rsvp', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'rsvp.html'));
});
app.get('/registry', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'registry.html'));
});

app.listen(PORT, () => {
  console.log(`Wedding site running on http://localhost:${PORT}`);
});
