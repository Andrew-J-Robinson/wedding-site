const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Fuse = require('fuse.js');
const { nanoid } = require('nanoid');
const { signToken, verifyAuth, isValidAdminPassword } = require('./api/_lib/auth');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const inviteesPath = path.join(DATA_DIR, 'invitees.json');
const guestsPath = path.join(DATA_DIR, 'guests.json');
const rsvpsPath = path.join(DATA_DIR, 'rsvps.json');
const settingsPath = path.join(DATA_DIR, 'settings.json');

app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ensureDataDir = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
};

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
  await ensureDataDir();
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
  await fs.rename(tempPath, filePath);
};

const requireAuth = (req, res, next) => {
  if (verifyAuth(req)) return next();
  return res.status(401).json({ error: 'Unauthorized' });
};

// ----- Settings (RSVP master + defaults) -----
const getSettings = async () => {
  try {
    const data = await fs.readFile(settingsPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') return { rsvpOpenGlobal: true };
    throw err;
  }
};

app.get('/api/settings', async (_req, res) => {
  const settings = await getSettings();
  res.json(settings);
});

app.get('/api/settings/rsvp', async (_req, res) => {
  const settings = await getSettings();
  res.json({
    rsvpOpenGlobal: settings.rsvpOpenGlobal !== false,
    photos: settings.photos || {},
    party: settings.party || [],
  });
});

app.patch('/api/settings', requireAuth, async (req, res) => {
  const current = await getSettings();
  const body = req.body || {};

  if (body.photoUpload) {
    const { slot, data, contentType } = body.photoUpload;
    if (!slot || !data || !contentType) {
      return res.status(400).json({ error: 'slot, data, and contentType are required' });
    }
    const ext = (contentType.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Remove any previous file for this slot (may have a different extension)
    try {
      const files = await fs.readdir(uploadsDir);
      for (const f of files) {
        if (f.startsWith(slot + '.')) await fs.unlink(path.join(uploadsDir, f));
      }
    } catch (_) {}

    const filename = `${slot}.${ext}`;
    await fs.writeFile(path.join(uploadsDir, filename), Buffer.from(data, 'base64'));
    const url = `/uploads/${filename}?t=${Date.now()}`;

    const next = { ...current, photos: { ...(current.photos || {}), [slot]: url } };
    await writeJson(settingsPath, next);
    return res.json({ url });
  }

  if (body.photoDelete) {
    const { slot } = body.photoDelete;
    if (!slot) return res.status(400).json({ error: 'slot is required' });

    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    try {
      const files = await fs.readdir(uploadsDir);
      for (const f of files) {
        if (f.startsWith(slot + '.')) await fs.unlink(path.join(uploadsDir, f));
      }
    } catch (_) {}

    const photos = { ...(current.photos || {}) };
    delete photos[slot];
    const next = { ...current, photos };
    await writeJson(settingsPath, next);
    return res.json({ ok: true });
  }

  const next = { ...current, ...body };
  await writeJson(settingsPath, next);
  res.json(next);
});

// ----- Guests (replaces invitees for admin; invitees search stays for RSVP flow) -----
const normalizeGuest = (item) => {
  if (!item || !item.name) return null;
  return {
    id: item.id || nanoid(),
    name: String(item.name).trim(),
    contact: item.contact || '',
    notes: item.notes || '',
    dietaryRestrictions: item.dietaryRestrictions || '',
    gift: item.gift || '',
    thankYouSent: !!item.thankYouSent,
    createdAt: item.createdAt || new Date().toISOString(),
  };
};

app.get('/api/guests', requireAuth, async (_req, res) => {
  let guests = await readJson(guestsPath, []);
  const legacyInvitees = await readJson(inviteesPath, []);
  if (guests.length === 0 && legacyInvitees.length > 0) {
    guests = legacyInvitees.map((inv) => normalizeGuest({ ...inv }));
    await writeJson(guestsPath, guests);
  }
  res.json(guests);
});

app.post('/api/guests', requireAuth, async (req, res) => {
  const list = await readJson(guestsPath, []);
  const one = normalizeGuest({ ...req.body, id: nanoid(), createdAt: new Date().toISOString() });
  if (!one) return res.status(400).json({ error: 'Guest name required' });
  list.push(one);
  await writeJson(guestsPath, list);
  res.json(one);
});

app.patch('/api/guests/:id', requireAuth, async (req, res) => {
  const list = await readJson(guestsPath, []);
  const i = list.findIndex((g) => g.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Guest not found' });
  list[i] = normalizeGuest({ ...list[i], ...req.body });
  await writeJson(guestsPath, list);
  res.json(list[i]);
});

app.delete('/api/guests/:id', requireAuth, async (req, res) => {
  const list = await readJson(guestsPath, []);
  const filtered = list.filter((g) => g.id !== req.params.id);
  if (filtered.length === list.length) return res.status(404).json({ error: 'Guest not found' });
  await writeJson(guestsPath, filtered);
  res.json({ ok: true });
});

// Bulk replace (import)
app.post('/api/guests/import', requireAuth, async (req, res) => {
  const payload = req.body;
  const array = Array.isArray(payload) ? payload : payload.guests;
  if (!Array.isArray(array)) return res.status(400).json({ error: 'Expect array of guests or { guests: [] }' });
  const normalized = array
    .map((item) => {
      const g = normalizeGuest({
        id: item.id || nanoid(),
        name: item.name,
        contact: item.contact || '',
        notes: item.notes || '',
        dietaryRestrictions: item.dietaryRestrictions || item.allergies || '',
        gift: item.gift || '',
        thankYouSent: !!item.thankYouSent,
        createdAt: item.createdAt || new Date().toISOString(),
      });
      return g;
    })
    .filter(Boolean);
  await writeJson(guestsPath, normalized);
  res.json({ count: normalized.length });
});

// Public search for RSVP flow (searches guests, fallback invitees)
app.get('/api/invitees/search', async (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name required' });

  let guests = await readJson(guestsPath, []);
  const legacyInvitees = await readJson(inviteesPath, []);
  if (guests.length === 0 && legacyInvitees.length > 0) {
    guests = legacyInvitees.map((inv) => normalizeGuest({ ...inv }));
    await writeJson(guestsPath, guests);
  }
  const list = guests.length ? guests : legacyInvitees.map((inv) => ({ ...inv, name: inv.name, id: inv.id, party: inv.party || 1, contact: inv.contact }));
  const fuse = new Fuse(list, { keys: ['name'], threshold: 0.4, includeScore: true });
  const results = fuse.search(name).map((r) => r.item).slice(0, 8);
  res.json({ results });
});

// ----- RSVPs -----
app.post('/api/rsvp', async (req, res) => {
  const settings = await getSettings();
  if (settings.rsvpOpenGlobal === false) return res.status(403).json({ error: 'RSVP is currently closed' });

  const { name, guestId, rsvp, allergies = '', note = '', headcount } = req.body || {};
  if (!name || !rsvp) return res.status(400).json({ error: 'Name and RSVP status are required' });

  const record = {
    id: nanoid(),
    guestId: guestId || null,
    name: String(name).trim(),
    rsvp: rsvp.toLowerCase(),
    headcount: headcount != null ? Number(headcount) : null,
    allergies: String(allergies || '').trim(),
    note: String(note || '').trim(),
    createdAt: new Date().toISOString(),
  };

  const existing = await readJson(rsvpsPath, []);
  existing.push(record);
  await writeJson(rsvpsPath, existing);
  res.json({ ok: true, id: record.id });
});

app.get('/api/rsvps', requireAuth, async (req, res) => {
  const data = await readJson(rsvpsPath, []);
  res.json({ results: data });
});

// ----- Auth -----
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (isValidAdminPassword(password)) return res.json({ token: signToken() });
  return res.status(401).json({ error: 'Invalid password' });
});

// Page routes
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
