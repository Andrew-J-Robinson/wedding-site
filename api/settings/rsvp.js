const supabase = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { data: row } = await supabase.from('settings').select('data').eq('id', 1).single();
  const settings = row?.data || {};

  const { data: events } = await supabase.from('events').select('id, name, rsvp_open').order('sort_order');

  res.json({
    rsvpOpenGlobal: settings.rsvpOpenGlobal !== false,
    events: (events || []).map((e) => ({ id: e.id, name: e.name, rsvpOpen: e.rsvp_open !== false })),
    photos: settings.photos || {},
  });
};
