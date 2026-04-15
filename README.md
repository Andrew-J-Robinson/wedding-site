# Wedding site

A responsive wedding website: public pages (home, RSVP, registry), a password-protected admin area for guests and RSVPs, and serverless APIs backed by Supabase (PostgreSQL). The frontend is static HTML with Tailwind CSS; APIs are Vercel serverless functions.

## Table of contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Project layout](#project-layout)
- [npm scripts](#npm-scripts)
- [Database migrations](#database-migrations)
- [Local development](#local-development)
- [Deployment](#deployment)
- [API overview](#api-overview)
- [Admin](#admin)
- [Guest import](#guest-import)
- [Testing](#testing)
- [Contributing](#contributing)
- [Security notes](#security-notes)

## Architecture

| Layer | Role |
|--------|------|
| **`public/`** | Static HTML, CSS, and client scripts. Served as the site root. |
| **`api/`** | Vercel serverless Node handlers (`/api/*`). Auth, guests, RSVPs, settings, health. |
| **`supabase/migrations/`** | Ordered SQL migrations applied to Postgres (tracked in `schema_migrations`). |
| **`src/tailwind.css`** | Tailwind source; compiled to **`public/tw.css`**. |
| **`data/`** | Optional local JSON used for development or backup (gitignored). Example shapes live in `*.example.json`. |

Shared server code lives under **`api/_lib/`** (Supabase client, JWT auth, login rate limiting, public settings helpers).

## Prerequisites

- **Node.js 20** (matches CI; newer LTS usually works)
- **npm**
- A **Supabase** project with database access
- **Vercel** (or compatible host) for production, if you deploy this repo as-is

## Getting started

1. **Clone** the repository and install dependencies:

   ```bash
   npm install
   ```

2. **Environment file** — copy the example and fill in values:

   ```bash
   cp .env.example .env
   ```

   See [Environment variables](#environment-variables) for where each value comes from.

3. **Build CSS** (required after changing Tailwind or `src/tailwind.css`):

   ```bash
   npm run build
   ```

4. **Apply database migrations** to your Supabase database (uses `DATABASE_URL` from `.env`):

   ```bash
   npm run migrate
   ```

5. **Run locally** — see [Local development](#local-development).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Project URL from Supabase → **Project Settings → API**. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Service role** key (server-only; never expose to the browser). |
| `DATABASE_URL` | Yes | Postgres connection string for migrations. Use the **Transaction** pooler string from Supabase → **Project Settings → Database → Connection string** (port **6543**). |
| `ADMIN_PASSWORD` | Yes | Password for the admin dashboard login. |
| `JWT_SECRET` | Yes | Secret used to sign admin session JWTs. Use a long random string in production. |

`scripts/run-migrations.js` documents the `DATABASE_URL` format in its header comments.

## Project layout

```
├── api/                 # Vercel serverless functions
│   ├── _lib/          # auth, supabase, rate limit, settings helpers
│   ├── guests/        # list, CRUD, import
│   ├── settings/      # site settings
│   ├── health.js
│   ├── login.js
│   ├── logout.js
│   └── rsvps.js
├── data/                # Local JSON (gitignored); see *.example.json in repo root
├── public/              # Static site: index, rsvp, registry, admin, theme, tw.css, assets
├── scripts/
│   └── run-migrations.js
├── src/
│   └── tailwind.css     # Tailwind entry → built to public/tw.css
├── supabase/migrations/ # SQL migrations (numeric prefix order)
├── test/                # Node.js built-in test runner
├── tailwind.config.js
├── vercel.json          # clean URLs, function memory/duration
└── .env.example
```

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile Tailwind: `src/tailwind.css` → `public/tw.css` (minified). |
| `npm run build:css` | Same as `build`. |
| `npm run migrate` | Run pending SQL in `supabase/migrations/` against `DATABASE_URL` (via `--env-file=.env`). |
| `npm test` | Run all tests under `test/` with Node’s test runner. |
| `npm run test:watch` | Same tests in watch mode. |

## Database migrations

- Add new files as `NNN_description.sql` under `supabase/migrations/`.
- The runner applies files in sorted order and records each filename in the `schema_migrations` table.
- **Do not edit** migrations that have already been applied to shared environments; add a new file instead.

Production migrations are automated: on **push to `main`** that changes files under `supabase/migrations/**`, GitHub Actions runs `node scripts/run-migrations.js` with `DATABASE_URL` from the **`PROD_DATABASE_URL`** repository secret. Treat merges to `main` as “this migration should run on production.”

## Local development

- **CSS changes:** edit `src/tailwind.css` or `tailwind.config.js`, then run `npm run build`.
- **Full stack (static + `/api`):** use the [Vercel CLI](https://vercel.com/docs/cli):

  ```bash
  npx vercel dev
  ```

  Link the project when prompted (or configure once). This serves `public/` and routes `/api/*` to the serverless handlers with environment variables from your linked project or local `.env` (per Vercel’s behavior).

- **Static pages only:** any static file server pointed at `public/` works for layout and styling, but RSVP/admin features need the API and env vars.

## Deployment

1. Connect the repo to **Vercel** (or deploy with the Vercel CLI).
2. Set the same environment variables as in [Environment variables](#environment-variables) in the Vercel project settings.
3. Ensure **`PROD_DATABASE_URL`** is set in GitHub **repository secrets** if you rely on the migration workflow.
4. Push to your production branch; Vercel builds and deploys. Migrations run via the workflow when migration files change on `main`.

`vercel.json` enables **clean URLs** (e.g. `/rsvp` without `.html` where routing supports it) and sets API function **memory** and **max duration**.

## API overview

| Route | Purpose |
|-------|---------|
| `GET /api/health` | Health check |
| `POST /api/login` | Admin login (rate limited) |
| `POST /api/logout` | Admin logout |
| `GET /api/rsvps` | List RSVPs (**authenticated**) |
| `POST /api/rsvps` | Submit an RSVP (**public**; blocked when `rsvpOpenGlobal` is false in settings) |
| `GET /api/guests` | With `?name=…`: fuzzy name search for RSVP (**public** subset). Without: full list (**authenticated**). |
| `POST /api/guests` | Create a guest (**authenticated**) |
| `PATCH /api/guests/[id]` | Update a guest (**authenticated**) |
| `DELETE /api/guests/[id]` | Delete a guest (**authenticated**) |
| `POST /api/guests/import` | Replace all guests from JSON (**authenticated**) |
| `GET /api/settings` | **Unauthenticated:** public-safe subset. **With valid admin JWT:** full settings JSON. |
| `PATCH /api/settings` | Update settings, including optional photo upload/delete payloads (**authenticated**) |

Exact request bodies and responses are defined in each file under `api/`.

## Admin

- **`/admin`** (clean URL) or **`public/admin.html`** — dashboard for guests and configuration.
- Login uses `ADMIN_PASSWORD`; sessions use JWTs signed with `JWT_SECRET`. Keep both strong in production.

## Guest import

`POST /api/guests/import` expects a JSON body that is either:

- an **array** of guest objects, or
- **`{ "guests": [ … ] }`**

Each guest should include at least **`name`**. Optional fields map to the database (e.g. `notes`, `dietaryRestrictions` / `allergies`, `thankYouSent`, `householdId`, `plusOneAllowed`). The handler **replaces all guests** in the table with the provided set. Requires an authenticated admin request.

## Testing

Tests use **Node.js’s built-in test runner** (`node --test`). Files live in `test/` and cover auth, login/logout endpoints, rate limiting, and settings payload behavior.

```bash
npm test
```

## Contributing

1. Create a branch from `main`.
2. Run **`npm test`** before opening a PR.
3. After Tailwind or config changes, run **`npm run build`** and commit **`public/tw.css`** if your workflow checks in built CSS.
4. For schema changes, add a **new** migration under `supabase/migrations/`; coordinate merges to `main` with production migration timing.

## Security notes

- **`SUPABASE_SERVICE_ROLE_KEY`** bypasses Row Level Security and must **only** run on the server. Never put it in client-side code or public repos.
- Use a **strong** `ADMIN_PASSWORD` and **`JWT_SECRET`** in production.
- Login is **rate limited** (see `api/_lib/loginRateLimit.js` and related migrations).
- Revocation of admin tokens is supported via the schema (see migrations under `supabase/migrations/`).
