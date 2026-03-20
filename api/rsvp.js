const supabase = require('./_lib/supabase');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { data: settingsRow } = await supabase.from('settings').select('data').eq('id', 1).single();
  const settings = settingsRow?.data || {};
  if (settings.rsvpOpenGlobal === false) return res.status(403).json({ error: 'RSVP is currently closed' });

  const { name, guestId, rsvp, allergies = '', note = '', headcount } = req.body || {};
  if (!name || !rsvp) return res.status(400).json({ error: 'Name and RSVP status are required' });

  const record = {
    id: crypto.randomUUID(),
    guest_id: guestId || null,
    name: String(name).trim(),
    rsvp: rsvp.toLowerCase(),
    headcount: headcount != null ? Number(headcount) : null,
    allergies: String(allergies || '').trim(),
    note: String(note || '').trim(),
  };

  const { error } = await supabase.from('rsvps').insert(record);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true, id: record.id });
};
