const supabase = require('../_lib/supabase');
const { verifyAuth } = require('../_lib/auth');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!verifyAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  const payload = req.body;
  const array = Array.isArray(payload) ? payload : payload?.guests;
  if (!Array.isArray(array)) return res.status(400).json({ error: 'Expect array of guests or { guests: [] }' });

  const { data: events } = await supabase.from('events').select('id').order('sort_order').limit(1);
  const defaultEventId = events?.[0]?.id || null;

  const rows = array
    .filter((item) => item && item.name)
    .map((item) => ({
      id: item.id || crypto.randomUUID(),
      household_id: item.householdId || null,
      name: String(item.name).trim(),
      contact: item.contact || '',
      invited_event_ids: Array.isArray(item.invitedEventIds)
        ? item.invitedEventIds
        : defaultEventId ? [defaultEventId] : [],
      notes: item.notes || '',
      dietary_restrictions: item.dietaryRestrictions || item.allergies || '',
      gift: item.gift || '',
      thank_you_sent: !!item.thankYouSent,
    }));

  // Replace all guests
  await supabase.from('guests').delete().neq('id', '');
  if (rows.length) {
    const { error } = await supabase.from('guests').insert(rows);
    if (error) return res.status(500).json({ error: error.message });
  }

  res.json({ count: rows.length });
};
