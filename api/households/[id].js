const supabase = require('../_lib/supabase');
const { verifyAuth } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (!verifyAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.query;

  if (req.method === 'PATCH') {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    const { data, error } = await supabase.from('households').update(updates).eq('id', id).select().single();
    if (error) return res.status(404).json({ error: 'Household not found' });
    return res.json(data);
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('households').delete().eq('id', id);
    if (error) return res.status(404).json({ error: 'Household not found' });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
