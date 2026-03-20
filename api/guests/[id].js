const supabase = require('../_lib/supabase');
const { verifyAuth } = require('../_lib/auth');

function toApi(g) {
  return {
    id: g.id,
    name: g.name,
    contact: g.contact,
    notes: g.notes,
    dietaryRestrictions: g.dietary_restrictions,
    gift: g.gift,
    thankYouSent: g.thank_you_sent,
    createdAt: g.created_at,
  };
}

module.exports = async function handler(req, res) {
  if (!(await verifyAuth(req))) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.query;

  if (req.method === 'PATCH') {
    const b = req.body || {};
    const updates = {};
    if (b.name !== undefined) updates.name = String(b.name).trim();
    if (b.contact !== undefined) updates.contact = b.contact;
    if (b.notes !== undefined) updates.notes = b.notes;
    if (b.dietaryRestrictions !== undefined) updates.dietary_restrictions = b.dietaryRestrictions;
    if (b.gift !== undefined) updates.gift = b.gift;
    if (b.thankYouSent !== undefined) updates.thank_you_sent = b.thankYouSent;

    const { data, error } = await supabase.from('guests').update(updates).eq('id', id).select().single();
    if (error) return res.status(404).json({ error: 'Guest not found' });
    return res.json(toApi(data));
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('guests').delete().eq('id', id);
    if (error) return res.status(404).json({ error: 'Guest not found' });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
