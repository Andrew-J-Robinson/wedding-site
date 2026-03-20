const supabase = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { data: row } = await supabase.from('settings').select('data').eq('id', 1).single();
  const settings = row?.data || {};

  res.json({
    rsvpOpenGlobal: settings.rsvpOpenGlobal !== false,
    photos: settings.photos || {},
    party: settings.party || [],
  });
};
