const supabase = require('../_lib/supabase');
const { verifyAuth } = require('../_lib/auth');
const { publicSettingsPayload } = require('../_lib/publicSettingsPayload');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const { data: row } = await supabase.from('settings').select('data').eq('id', 1).single();
    const settings = row?.data || {};

    if (!(await verifyAuth(req))) {
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return res.json(publicSettingsPayload(settings));
    }

    res.setHeader('Cache-Control', 'private, no-cache');
    return res.json(settings);
  }

  if (req.method === 'PATCH') {
    if (!(await verifyAuth(req))) return res.status(401).json({ error: 'Unauthorized' });

    const body = req.body || {};

    if (body.photoUpload) {
      const { slot, data, contentType } = body.photoUpload;
      if (!slot || !data || !contentType) {
        return res.status(400).json({ error: 'slot, data, and contentType are required' });
      }
      const buffer = Buffer.from(data, 'base64');
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(slot, buffer, { contentType, upsert: true });
      if (uploadError) return res.status(500).json({ error: uploadError.message });

      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(slot);
      const baseUrl = urlData.publicUrl;
      const versionedUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
      const { data: row } = await supabase.from('settings').select('data').eq('id', 1).single();
      const current = row?.data || {};
      const next = { ...current, photos: { ...(current.photos || {}), [slot]: versionedUrl } };
      const { error: saveError } = await supabase.from('settings').update({ data: next }).eq('id', 1);
      if (saveError) return res.status(500).json({ error: saveError.message });
      return res.json({ url: versionedUrl });
    }

    if (body.photoDelete) {
      const { slot } = body.photoDelete;
      if (!slot) return res.status(400).json({ error: 'slot is required' });
      await supabase.storage.from('photos').remove([slot]);
      const { data: row } = await supabase.from('settings').select('data').eq('id', 1).single();
      const current = row?.data || {};
      const photos = { ...(current.photos || {}) };
      delete photos[slot];
      const next = { ...current, photos };
      const { error: saveError } = await supabase.from('settings').update({ data: next }).eq('id', 1);
      if (saveError) return res.status(500).json({ error: saveError.message });
      return res.json({ ok: true });
    }

    const { data: row } = await supabase.from('settings').select('data').eq('id', 1).single();
    const current = row?.data || {};
    const next = { ...current, ...body };
    const { error } = await supabase.from('settings').update({ data: next }).eq('id', 1);
    if (error) return res.status(500).json({ error: error.message });
    return res.json(next);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
