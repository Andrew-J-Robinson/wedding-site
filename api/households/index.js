const supabase = require('../_lib/supabase');
const { verifyAuth } = require('../_lib/auth');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    if (!verifyAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { data } = await supabase.from('households').select('*').order('created_at');
    return res.json(data || []);
  }

  if (req.method === 'POST') {
    if (!verifyAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
    const name = String(req.body.name || '').trim() || 'Unnamed household';
    const row = { id: crypto.randomUUID(), name };
    const { data, error } = await supabase.from('households').insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
