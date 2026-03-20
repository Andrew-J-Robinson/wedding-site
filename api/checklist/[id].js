const supabase = require('../_lib/supabase');
const { verifyAuth } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (!verifyAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.query;

  if (req.method === 'PATCH') {
    const updates = {};
    if (req.body.title !== undefined) updates.title = String(req.body.title).trim();
    if (req.body.completed !== undefined) updates.completed = !!req.body.completed;
    if (req.body.order !== undefined) updates.sort_order = req.body.order;

    const { data, error } = await supabase.from('checklist').update(updates).eq('id', id).select().single();
    if (error) return res.status(404).json({ error: 'Task not found' });
    return res.json({ id: data.id, title: data.title, order: data.sort_order, completed: data.completed, createdAt: data.created_at });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('checklist').delete().eq('id', id);
    if (error) return res.status(404).json({ error: 'Task not found' });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
