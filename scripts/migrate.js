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

  // --- Events ---
  const events = readLocal('events.json', []);
  if (events.length) {
    console.log(`Migrating ${events.length} event(s)...`);
    const rows = events.map((e) => ({
      id: e.id,
      name: e.name,
      rsvp_open: e.rsvpOpen !== false,
      sort_order: e.order ?? 0,
    }));
    const { error } = await supabase.from('events').upsert(rows);
    if (error) console.error('  events error:', error.message);
    else console.log('  events OK');
  }

  // --- Households ---
  const households = readLocal('households.json', []);
  if (households.length) {
    console.log(`Migrating ${households.length} household(s)...`);
    const rows = households.map((h) => ({
      id: h.id,
      name: h.name,
      created_at: h.createdAt || new Date().toISOString(),
    }));
    const { error } = await supabase.from('households').upsert(rows);
    if (error) console.error('  households error:', error.message);
    else console.log('  households OK');
  }

  // --- Guests ---
  const guests = readLocal('guests.json', []);
  if (guests.length) {
    console.log(`Migrating ${guests.length} guest(s)...`);
    const rows = guests.map((g) => ({
      id: g.id,
      household_id: g.householdId || null,
      name: g.name,
      contact: g.contact || '',
      invited_event_ids: g.invitedEventIds || [],
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
      event_id: r.eventId || null,
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

  // --- Checklist ---
  const checklist = readLocal('checklist.json', []);
  if (checklist.length) {
    console.log(`Migrating ${checklist.length} checklist task(s)...`);
    const rows = checklist.map((t) => ({
      id: t.id,
      title: t.title,
      sort_order: t.order ?? 0,
      completed: !!t.completed,
      created_at: t.createdAt || new Date().toISOString(),
    }));
    const { error } = await supabase.from('checklist').upsert(rows);
    if (error) console.error('  checklist error:', error.message);
    else console.log('  checklist OK');
  }

  // --- Vendors ---
  const vendors = readLocal('vendors.json', []);
  if (vendors.length) {
    console.log(`Migrating ${vendors.length} vendor(s)...`);
    const rows = vendors.map((v) => ({
      id: v.id,
      name: v.name || '',
      category: v.category || '',
      email: v.email || '',
      phone: v.phone || '',
      notes: v.notes || '',
      created_at: v.createdAt || new Date().toISOString(),
    }));
    const { error } = await supabase.from('vendors').upsert(rows);
    if (error) console.error('  vendors error:', error.message);
    else console.log('  vendors OK');
  }

  console.log('\nMigration complete.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
