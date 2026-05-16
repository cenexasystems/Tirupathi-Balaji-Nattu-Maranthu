# Naatu Shop Frontend (Supabase)

This is a browser-only React + Vite frontend connected to Supabase.

## Environment Variables

Create `.env` with:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`.env.example` already includes the same keys for deployment reference.

## Local Build

```bash
npm install
npm run build
```

## Vercel Deployment

1. Import the `naatu-shop` folder as a Vercel project.
2. In Vercel Project Settings > Environment Variables, set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Build command: `npm run build`
4. Output directory: `dist`

No custom Node server is required for this frontend deployment.

## Supabase Migrations (Production)

Run canonical SQL migrations in this exact order from Supabase SQL Editor:

1. `supabase/migrations/20260426_0001_canonical_hardening.sql`
2. `supabase/migrations/20260426_0002_order_items_atomic_order.sql`
3. `supabase/migrations/20260427_0003_catalog_cleanup_release_prep.sql`

The third migration performs release cleanup so only the curated active catalog is exposed to storefront/POS.

## Legacy Seed Files

`seed_products.sql`, `COMPLETE_SETUP.sql`, `supabase_schema.sql`, and generated SQL artifacts are legacy setup files.
Do not run them in production release-prep workflows.
