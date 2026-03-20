const supabase = require('../_lib/supabase');
const { verifyAuth } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (!verifyAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.query;

  if (req.method === 'PATCH') {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.rsvpOpen !== undefined) updates.rsvp_open = req.body.rsvpOpen;
    if (req.body.order !== undefined) updates.sort_order = req.body.order;

    const { data, error } = await supabase.from('events').update(updates).eq('id', id).select().single();
    if (error) return res.status(404).json({ error: 'Event not found' });
    return res.json({ id: data.id, name: data.name, rsvpOpen: data.rsvp_open, order: data.sort_order });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) return res.status(404).json({ error: 'Event not found' });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
