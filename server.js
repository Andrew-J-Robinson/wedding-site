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

const DATA_DIR = path.join(__dirname, 'data');
const inviteesPath = path.join(DATA_DIR, 'invitees.json');
const guestsPath = path.join(DATA_DIR, 'guests.json');
const householdsPath = path.join(DATA_DIR, 'households.json');
const eventsPath = path.join(DATA_DIR, 'events.json');
const rsvpsPath = path.join(DATA_DIR, 'rsvps.json');
const settingsPath = path.join(DATA_DIR, 'settings.json');
const checklistPath = path.join(DATA_DIR, 'checklist.json');


const sessionTokens = new Set();

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
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token && sessionTokens.has(token)) return next();
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
  const events = await ensureDefaultEvents();
  res.json({
    rsvpOpenGlobal: settings.rsvpOpenGlobal !== false,
    events: events.map((e) => ({ id: e.id, name: e.name, rsvpOpen: e.rsvpOpen !== false })),
    photos: settings.photos || {},
    partyMembers: settings.partyMembers || {},
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

// ----- Events -----
const ensureDefaultEvents = async () => {
  let events = await readJson(eventsPath, []);
  if (events.length === 0) {
    events = [
      { id: nanoid(), name: 'Wedding', rsvpOpen: true, order: 0 },
      { id: nanoid(), name: 'Bridal Shower', rsvpOpen: false, order: 1 },
      { id: nanoid(), name: 'Rehearsal Dinner', rsvpOpen: false, order: 2 },
    ];
    await writeJson(eventsPath, events);
  }
  return events;
};

app.get('/api/events', async (_req, res) => {
  const events = await ensureDefaultEvents();
  res.json(events);
});

app.post('/api/events', requireAuth, async (req, res) => {
  const events = await readJson(eventsPath, []);
  const maxOrder = events.length ? Math.max(...events.map((e) => e.order ?? 0)) : -1;
  const newEvent = {
    id: nanoid(),
    name: String(req.body.name || 'Event').trim(),
    rsvpOpen: req.body.rsvpOpen !== false,
    order: maxOrder + 1,
  };
  events.push(newEvent);
  await writeJson(eventsPath, events);
  res.json(newEvent);
});

app.patch('/api/events/:id', requireAuth, async (req, res) => {
  const events = await readJson(eventsPath, []);
  const i = events.findIndex((e) => e.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Event not found' });
  events[i] = { ...events[i], ...req.body };
  await writeJson(eventsPath, events);
  res.json(events[i]);
});

app.delete('/api/events/:id', requireAuth, async (req, res) => {
  const events = await readJson(eventsPath, []);
  const filtered = events.filter((e) => e.id !== req.params.id);
  if (filtered.length === events.length) return res.status(404).json({ error: 'Event not found' });
  await writeJson(eventsPath, filtered);
  res.json({ ok: true });
});

app.post('/api/events/reorder', requireAuth, async (req, res) => {
  const { order } = req.body || {};
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be array of ids' });
  const events = await readJson(eventsPath, []);
  const byId = new Map(events.map((e) => [e.id, e]));
  const reordered = order.map((id, idx) => (byId.get(id) ? { ...byId.get(id), order: idx } : null)).filter(Boolean);
  const rest = events.filter((e) => !order.includes(e.id));
  const merged = [...reordered, ...rest].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  await writeJson(eventsPath, merged);
  res.json(merged);
});

// ----- Households -----
app.get('/api/households', async (_req, res) => {
  const list = await readJson(householdsPath, []);
  res.json(list);
});

app.post('/api/households', requireAuth, async (req, res) => {
  const list = await readJson(householdsPath, []);
  const name = String(req.body.name || '').trim() || 'Unnamed household';
  const newOne = { id: nanoid(), name, createdAt: new Date().toISOString() };
  list.push(newOne);
  await writeJson(householdsPath, list);
  res.json(newOne);
});

app.patch('/api/households/:id', requireAuth, async (req, res) => {
  const list = await readJson(householdsPath, []);
  const i = list.findIndex((h) => h.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Household not found' });
  list[i] = { ...list[i], ...req.body };
  await writeJson(householdsPath, list);
  res.json(list[i]);
});

app.delete('/api/households/:id', requireAuth, async (req, res) => {
  const list = await readJson(householdsPath, []);
  const filtered = list.filter((h) => h.id !== req.params.id);
  if (filtered.length === list.length) return res.status(404).json({ error: 'Household not found' });
  await writeJson(householdsPath, filtered);
  res.json({ ok: true });
});

// ----- Guests (replaces invitees for admin; invitees search stays for RSVP flow) -----
const normalizeGuest = (item) => {
  if (!item || !item.name) return null;
  return {
    id: item.id || nanoid(),
    householdId: item.householdId || null,
    name: String(item.name).trim(),
    contact: item.contact || '',
    invitedEventIds: Array.isArray(item.invitedEventIds) ? item.invitedEventIds : [],
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
    const events = await ensureDefaultEvents();
    const defaultEventId = events[0]?.id || null;
    guests = legacyInvitees.map((inv) =>
      normalizeGuest({
        ...inv,
        invitedEventIds: defaultEventId ? [defaultEventId] : [],
      })
    );
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
  const events = await ensureDefaultEvents();
  const defaultEventId = events[0]?.id || null;
  const normalized = array
    .map((item) => {
      const g = normalizeGuest({
        id: item.id || nanoid(),
        householdId: item.householdId || null,
        name: item.name,
        contact: item.contact || '',
        invitedEventIds: Array.isArray(item.invitedEventIds) ? item.invitedEventIds : defaultEventId ? [defaultEventId] : [],
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
    const events = await ensureDefaultEvents();
    const defaultEventId = events[0]?.id || null;
    guests = legacyInvitees.map((inv) =>
      normalizeGuest({
        ...inv,
        invitedEventIds: defaultEventId ? [defaultEventId] : [],
      })
    );
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

  const events = await readJson(eventsPath, []);
  const eventId = req.body.eventId || (events[0] && events[0].id);
  if (eventId) {
    const event = events.find((e) => e.id === eventId);
    if (event && event.rsvpOpen === false) return res.status(403).json({ error: 'RSVP is closed for this event' });
  }

  const { name, guestId, rsvp, allergies = '', note = '', headcount } = req.body || {};
  if (!name || !rsvp) return res.status(400).json({ error: 'Name and RSVP status are required' });

  const record = {
    id: nanoid(),
    guestId: guestId || null,
    eventId: eventId || null,
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
  const eventId = req.query.eventId;
  const results = eventId ? data.filter((r) => r.eventId === eventId) : data;
  res.json({ results });
});

// ----- Checklist -----
const normalizeTask = (item) => ({
  id: item.id || nanoid(),
  title: String(item.title || '').trim(),
  order: typeof item.order === 'number' ? item.order : 0,
  completed: !!item.completed,
  createdAt: item.createdAt || new Date().toISOString(),
});

app.get('/api/checklist', requireAuth, async (_req, res) => {
  let list = await readJson(checklistPath, []);
  if (list.length === 0) {
    const defaults = [
      'Book venue',
      'Send save-the-dates',
      'Finalize guest list',
      'Book caterer',
      'Order invitations',
      'Book photographer',
      'Book florist',
      'Plan rehearsal dinner',
      'Create seating chart',
      'Send thank-you notes',
    ].map((title, i) => ({ id: nanoid(), title, order: i, completed: false, createdAt: new Date().toISOString() }));
    list = defaults;
    await writeJson(checklistPath, list);
  }
  list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  res.json(list);
});

app.post('/api/checklist', requireAuth, async (req, res) => {
  const list = await readJson(checklistPath, []);
  const maxOrder = list.length ? Math.max(...list.map((t) => t.order ?? 0)) : -1;
  const task = normalizeTask({ ...req.body, order: maxOrder + 1 });
  list.push(task);
  await writeJson(checklistPath, list);
  res.json(task);
});

app.patch('/api/checklist/:id', requireAuth, async (req, res) => {
  const list = await readJson(checklistPath, []);
  const i = list.findIndex((t) => t.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Task not found' });
  list[i] = normalizeTask({ ...list[i], ...req.body });
  await writeJson(checklistPath, list);
  res.json(list[i]);
});

app.delete('/api/checklist/:id', requireAuth, async (req, res) => {
  const list = await readJson(checklistPath, []);
  const filtered = list.filter((t) => t.id !== req.params.id);
  if (filtered.length === list.length) return res.status(404).json({ error: 'Task not found' });
  await writeJson(checklistPath, filtered);
  res.json({ ok: true });
});

app.post('/api/checklist/reorder', requireAuth, async (req, res) => {
  const { order } = req.body || {};
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be array of ids' });
  const list = await readJson(checklistPath, []);
  const byId = new Map(list.map((t) => [t.id, t]));
  const reordered = order.map((id, idx) => (byId.get(id) ? { ...byId.get(id), order: idx } : null)).filter(Boolean);
  const rest = list.filter((t) => !order.includes(t.id));
  const merged = [...reordered, ...rest].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  await writeJson(checklistPath, merged);
  res.json(merged);
});

// ----- Auth -----
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    const token = nanoid();
    sessionTokens.add(token);
    return res.json({ token });
  }
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
