const supabase = require('../_lib/supabase');
const { verifyAuth } = require('../_lib/auth');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const { data: events } = await supabase.from('events').select('*').order('sort_order');
    const mapped = (events || []).map((e) => ({
      id: e.id,
      name: e.name,
      rsvpOpen: e.rsvp_open,
      order: e.sort_order,
    }));
    return res.json(mapped);
  }

  if (req.method === 'POST') {
    if (!verifyAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

    const { data: existing } = await supabase.from('events').select('sort_order').order('sort_order', { ascending: false }).limit(1);
    const maxOrder = existing?.length ? existing[0].sort_order : -1;

    const newEvent = {
      id: crypto.randomUUID(),
      name: String(req.body.name || 'Event').trim(),
      rsvp_open: req.body.rsvpOpen !== false,
      sort_order: maxOrder + 1,
    };

    const { error } = await supabase.from('events').insert(newEvent);
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ id: newEvent.id, name: newEvent.name, rsvpOpen: newEvent.rsvp_open, order: newEvent.sort_order });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
