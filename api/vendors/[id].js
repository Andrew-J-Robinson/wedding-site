const supabase = require('../_lib/supabase');
const { verifyAuth } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (!verifyAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.query;

  if (req.method === 'PATCH') {
    const b = req.body || {};
    const updates = {};
    if (b.name !== undefined) updates.name = String(b.name).trim();
    if (b.category !== undefined) updates.category = String(b.category).trim();
    if (b.email !== undefined) updates.email = String(b.email).trim();
    if (b.phone !== undefined) updates.phone = String(b.phone).trim();
    if (b.notes !== undefined) updates.notes = String(b.notes).trim();

    const { data, error } = await supabase.from('vendors').update(updates).eq('id', id).select().single();
    if (error) return res.status(404).json({ error: 'Vendor not found' });
    return res.json(data);
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('vendors').delete().eq('id', id);
    if (error) return res.status(404).json({ error: 'Vendor not found' });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
