const supabase = require('../_lib/supabase');
const { verifyAuth } = require('../_lib/auth');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await verifyAuth(req))) return res.status(401).json({ error: 'Unauthorized' });

  const payload = req.body;
  const isLegacyArray = Array.isArray(payload);
  const array = isLegacyArray ? payload : payload?.guests;
  if (!Array.isArray(array)) return res.status(400).json({ error: 'Expect array of guests or { guests: [] }' });

  // Legacy array body preserves old "replace" behavior. Object body defaults to merge.
  const requestedMode = !isLegacyArray && payload?.mode ? String(payload.mode) : (isLegacyArray ? 'replace' : 'merge');
  const mode = requestedMode === 'replace' ? 'replace' : 'merge';

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
      has_kids: !!item.hasKids,
    }));

  if (mode === 'replace') {
    await supabase.from('guests').delete().neq('id', '');
    if (rows.length) {
      const { error } = await supabase.from('guests').insert(rows);
      if (error) return res.status(500).json({ error: error.message });
    }
    return res.json({ count: rows.length, inserted: rows.length, updated: 0, mode });
  }

  // Merge: match existing by id if present, else by case-insensitive name.
  const { data: existing, error: fetchErr } = await supabase.from('guests').select('id, name');
  if (fetchErr) return res.status(500).json({ error: fetchErr.message });

  const existingIds = new Set((existing || []).map((g) => g.id));
  const byName = new Map((existing || []).map((g) => [g.name.trim().toLowerCase(), g.id]));

  const inserts = [];
  const updates = [];
  for (const row of rows) {
    const matchId = row.id && existingIds.has(row.id)
      ? row.id
      : byName.get(row.name.trim().toLowerCase());
    if (matchId) {
      const { id: _omit, ...rest } = row;
      updates.push({ id: matchId, ...rest });
    } else {
      inserts.push(row);
    }
  }

  if (inserts.length) {
    const { error } = await supabase.from('guests').insert(inserts);
    if (error) return res.status(500).json({ error: error.message });
  }
  for (const u of updates) {
    const { id, ...rest } = u;
    const { error } = await supabase.from('guests').update(rest).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
  }

  return res.json({ count: rows.length, inserted: inserts.length, updated: updates.length, mode });
};
