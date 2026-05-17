Bootstrap artifacts for database seeding and local development.

This folder contains files intended only for one-time database bootstrapping or developer convenience. They are not imported by the production runtime.

- `products.json` - product dataset used by `seedProducts.ts`.
- `seedProducts.ts` - script to seed Supabase using a service role key.
- `generateProducts.cjs` and `generateProducts.js-output` - helper that generates SQL for larger seeds.

Do NOT include `bootstrap` artifacts in production bundles. Keep secrets out of the repo and use environment variables managed by your deployment platform.
