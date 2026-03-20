const supabase = require('../_lib/supabase');
const { verifyAuth } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (!verifyAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { data: row } = await supabase.from('settings').select('data').eq('id', 1).single();
    return res.json(row?.data || {});
  }

  if (req.method === 'PATCH') {
    const { data: row } = await supabase.from('settings').select('data').eq('id', 1).single();
    const current = row?.data || {};
    const next = { ...current, ...req.body };
    const { error } = await supabase.from('settings').update({ data: next }).eq('id', 1);
    if (error) return res.status(500).json({ error: error.message });
    return res.json(next);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
