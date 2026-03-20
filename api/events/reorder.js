const supabase = require('../_lib/supabase');
const { verifyAuth } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!verifyAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { order } = req.body || {};
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be array of ids' });

  const updates = order.map((id, idx) =>
    supabase.from('events').update({ sort_order: idx }).eq('id', id)
  );
  await Promise.all(updates);

  const { data: events } = await supabase.from('events').select('*').order('sort_order');
  const mapped = (events || []).map((e) => ({ id: e.id, name: e.name, rsvpOpen: e.rsvp_open, order: e.sort_order }));
  res.json(mapped);
};
