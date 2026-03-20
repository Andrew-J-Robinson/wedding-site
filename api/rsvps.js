const supabase = require('./_lib/supabase');
const { verifyAuth } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!verifyAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { data } = await supabase.from('rsvps').select('*').order('created_at');
  const results = (data || []).map((r) => ({
    id: r.id,
    guestId: r.guest_id,
    name: r.name,
    rsvp: r.rsvp,
    headcount: r.headcount,
    allergies: r.allergies,
    note: r.note,
    createdAt: r.created_at,
  }));

  res.json({ results });
};
