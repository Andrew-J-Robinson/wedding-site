/**
 * Idempotent migration runner for Supabase (via direct Postgres connection).
 *
 * Reads SQL files from supabase/migrations/ in numeric order and applies any
 * that have not yet been recorded in the schema_migrations table.
 *
 * Requires:
 *   DATABASE_URL  — Supabase "Transaction" pooler connection string, e.g.
 *                   postgresql://postgres.ref:password@aws-0-region.pooler.supabase.com:6543/postgres
 *                   Found in: Supabase dashboard → Settings → Database → Connection string → Transaction
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/run-migrations.js
 *
 * Or via npm:
 *   npm run migrate
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Error: DATABASE_URL must be set.');
  console.error('Find it in: Supabase dashboard → Settings → Database → Connection string → Transaction');
  process.exit(1);
}

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

async function main() {
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found at supabase/migrations/. Nothing to do.');
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // Create the tracking table if it doesn't exist
    await client.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    // Find which migrations have already been applied
    const { rows } = await client.query('select filename from schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    console.log(`Found ${files.length} migration file(s), ${applied.size} already applied.`);

    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('All migrations are up to date.');
      return;
    }

    console.log(`Applying ${pending.length} migration(s)...`);

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      process.stdout.write(`  Applying ${file}... `);

      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (filename) values ($1)', [file]);
        await client.query('commit');
        console.log('done');
      } catch (err) {
        await client.query('rollback');
        console.log('FAILED');
        console.error(`  Error: ${err.message}`);
        process.exit(1);
      }
    }

    console.log('\nAll migrations applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration runner failed:', err.message);
  process.exit(1);
});
