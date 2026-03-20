const supabase = require('../_lib/supabase');
const { verifyAuth } = require('../_lib/auth');
const crypto = require('crypto');
const Fuse = require('fuse.js');

function toApi(g) {
  return {
    id: g.id,
    name: g.name,
    contact: g.contact,
    notes: g.notes,
    dietaryRestrictions: g.dietary_restrictions,
    gift: g.gift,
    thankYouSent: g.thank_you_sent,
    createdAt: g.created_at,
  };
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const searchName = (req.query.name || '').trim();
    if (searchName) {
      const { data: guests } = await supabase.from('guests').select('id, name, contact');
      const list = (guests || []).map((g) => ({
        id: g.id,
        name: g.name,
        contact: g.contact,
      }));

      const fuse = new Fuse(list, { keys: ['name'], threshold: 0.4, includeScore: true });
      const results = fuse.search(searchName).map((r) => r.item).slice(0, 8);

      return res.json({ results });
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
      contact: b.contact || '',
      notes: b.notes || '',
      dietary_restrictions: b.dietaryRestrictions || '',
      gift: b.gift || '',
      thank_you_sent: !!b.thankYouSent,
    };

    const { data, error } = await supabase.from('guests').insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(toApi(data));
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
