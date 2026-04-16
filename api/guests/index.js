const supabase = require('../_lib/supabase');
const { verifyAuth } = require('../_lib/auth');
const crypto = require('crypto');
const Fuse = require('fuse.js');

function toApi(g) {
  return {
    id: g.id,
    name: g.name,
    notes: g.notes,
    dietaryRestrictions: g.dietary_restrictions,
    thankYouSent: g.thank_you_sent,
    householdId: g.household_id || null,
    plusOneAllowed: !!g.plus_one_allowed,
    hasKids: !!g.has_kids,
    createdAt: g.created_at,
  };
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const searchName = (req.query.name || '').trim();
    if (searchName) {
      const { data: guests } = await supabase
        .from('guests')
        .select('id, name, household_id, plus_one_allowed, has_kids');
      const list = (guests || []).map((g) => ({
        id: g.id,
        name: g.name,
        householdId: g.household_id || null,
        plusOneAllowed: !!g.plus_one_allowed,
        hasKids: !!g.has_kids,
      }));

      const fuse = new Fuse(list, { keys: ['name'], threshold: 0.4, includeScore: true });
      const matched = fuse.search(searchName).map((r) => r.item).slice(0, 8);

      const householdIds = [...new Set(matched.map((m) => m.householdId).filter(Boolean))];
      let householdMembers = [];
      if (householdIds.length) {
        householdMembers = list.filter(
          (g) => householdIds.includes(g.householdId) && !matched.some((m) => m.id === g.id)
        );
      }

      return res.json({ results: matched, householdMembers });
    }

    if (!(await verifyAuth(req))) return res.status(401).json({ error: 'Unauthorized' });

    const { data } = await supabase.from('guests').select('*').order('created_at');
    return res.json((data || []).map(toApi));
  }

  if (req.method === 'POST') {
    if (!(await verifyAuth(req))) return res.status(401).json({ error: 'Unauthorized' });

    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'Guest name required' });

    const row = {
      id: crypto.randomUUID(),
      name: String(b.name).trim(),
      notes: b.notes || '',
      dietary_restrictions: b.dietaryRestrictions || '',
      thank_you_sent: !!b.thankYouSent,
      household_id: b.householdId || null,
      plus_one_allowed: !!b.plusOneAllowed,
      has_kids: !!b.hasKids,
    };

    const { data, error } = await supabase.from('guests').insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(toApi(data));
  }

  if (req.method === 'DELETE') {
    if (!(await verifyAuth(req))) return res.status(401).json({ error: 'Unauthorized' });

    const ids = req.body?.ids;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids array required' });

    const { error } = await supabase.from('guests').delete().in('id', ids);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, deleted: ids.length });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
