const supabase = require('../_lib/supabase');
const Fuse = require('fuse.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const name = (req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name required' });

  const { data: guests } = await supabase.from('guests').select('id, name, contact');
  const list = (guests || []).map((g) => ({
    id: g.id,
    name: g.name,
    contact: g.contact,
  }));

  const fuse = new Fuse(list, { keys: ['name'], threshold: 0.4, includeScore: true });
  const results = fuse.search(name).map((r) => r.item).slice(0, 8);

  res.json({ results });
};
