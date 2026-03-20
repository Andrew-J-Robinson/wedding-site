/**
 * Migrate local data/*.json files into Supabase.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/migrate.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(url, key);
const dataDir = path.join(__dirname, '..', 'data');

function readLocal(filename, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir, filename), 'utf-8'));
  } catch {
    return fallback;
  }
}

async function main() {
  // --- Settings ---
  const settings = readLocal('settings.json', { rsvpOpenGlobal: true });
  console.log('Migrating settings...');
  const { error: settingsErr } = await supabase
    .from('settings')
    .upsert({ id: 1, data: settings });
  if (settingsErr) console.error('  settings error:', settingsErr.message);
  else console.log('  settings OK');

  // --- Guests ---
  const guests = readLocal('guests.json', []);
  if (guests.length) {
    console.log(`Migrating ${guests.length} guest(s)...`);
    const rows = guests.map((g) => ({
      id: g.id,
      name: g.name,
      contact: g.contact || '',
      notes: g.notes || '',
      dietary_restrictions: g.dietaryRestrictions || '',
      gift: g.gift || '',
      thank_you_sent: !!g.thankYouSent,
      created_at: g.createdAt || new Date().toISOString(),
    }));
    // Batch in groups of 100 to avoid payload limits
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await supabase.from('guests').upsert(batch);
      if (error) console.error(`  guests batch ${i} error:`, error.message);
    }
    console.log('  guests OK');
  }

  // --- RSVPs ---
  const rsvps = readLocal('rsvps.json', []);
  if (rsvps.length) {
    console.log(`Migrating ${rsvps.length} RSVP(s)...`);
    const rows = rsvps.map((r) => ({
      id: r.id,
      guest_id: r.guestId || null,
      name: r.name,
      rsvp: r.rsvp,
      headcount: r.headcount ?? null,
      allergies: r.allergies || '',
      note: r.note || '',
      created_at: r.createdAt || new Date().toISOString(),
    }));
    const { error } = await supabase.from('rsvps').upsert(rows);
    if (error) console.error('  rsvps error:', error.message);
    else console.log('  rsvps OK');
  }

  console.log('\nMigration complete.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
