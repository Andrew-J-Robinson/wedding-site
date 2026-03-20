const supabase = require('../_lib/supabase');
const { verifyAuth } = require('../_lib/auth');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (!verifyAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { data } = await supabase.from('vendors').select('*').order('created_at');
    return res.json(data || []);
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    const row = {
      id: crypto.randomUUID(),
      name: String(b.name || '').trim(),
      category: String(b.category || '').trim(),
      email: String(b.email || '').trim(),
      phone: String(b.phone || '').trim(),
      notes: String(b.notes || '').trim(),
    };

    const { data, error } = await supabase.from('vendors').insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
