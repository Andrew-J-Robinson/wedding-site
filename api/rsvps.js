const supabase = require('./_lib/supabase');
const { verifyAuth } = require('./_lib/auth');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    if (!(await verifyAuth(req))) return res.status(401).json({ error: 'Unauthorized' });

    const { data } = await supabase.from('rsvps').select('*').order('created_at');
    const results = (data || []).map((r) => ({
      id: r.id,
      guestId: r.guest_id,
      name: r.name,
      rsvp: r.rsvp,
      headcount: r.headcount,
      allergies: r.allergies,
      note: r.note,
      createdAt: r.created_at,
    }));

    return res.json({ results });
  }

  if (req.method === 'POST') {
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

    return res.json({ ok: true, id: record.id });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
