const supabase = require('../_lib/supabase');
const { verifyAuth } = require('../_lib/auth');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (!verifyAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { data } = await supabase.from('checklist').select('*').order('sort_order');
    const mapped = (data || []).map((t) => ({
      id: t.id,
      title: t.title,
      order: t.sort_order,
      completed: t.completed,
      createdAt: t.created_at,
    }));
    return res.json(mapped);
  }

  if (req.method === 'POST') {
    const { data: existing } = await supabase.from('checklist').select('sort_order').order('sort_order', { ascending: false }).limit(1);
    const maxOrder = existing?.length ? existing[0].sort_order : -1;

    const row = {
      id: crypto.randomUUID(),
      title: String(req.body.title || '').trim(),
      sort_order: maxOrder + 1,
      completed: false,
    };

    const { data, error } = await supabase.from('checklist').insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ id: data.id, title: data.title, order: data.sort_order, completed: data.completed, createdAt: data.created_at });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
