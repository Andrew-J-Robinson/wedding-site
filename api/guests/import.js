const supabase = require('../_lib/supabase');
const { verifyAuth } = require('../_lib/auth');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await verifyAuth(req))) return res.status(401).json({ error: 'Unauthorized' });

  const payload = req.body;
  const array = Array.isArray(payload) ? payload : payload?.guests;
  if (!Array.isArray(array)) return res.status(400).json({ error: 'Expect array of guests or { guests: [] }' });

  const rows = array
    .filter((item) => item && item.name)
    .map((item) => ({
      id: item.id || crypto.randomUUID(),
      name: String(item.name).trim(),
      notes: item.notes || '',
      dietary_restrictions: item.dietaryRestrictions || item.allergies || '',
      thank_you_sent: !!item.thankYouSent,
      household_id: item.householdId || null,
      plus_one_allowed: !!item.plusOneAllowed,
    }));

  // Replace all guests
  await supabase.from('guests').delete().neq('id', '');
  if (rows.length) {
    const { error } = await supabase.from('guests').insert(rows);
    if (error) return res.status(500).json({ error: error.message });
  }

  res.json({ count: rows.length });
};
