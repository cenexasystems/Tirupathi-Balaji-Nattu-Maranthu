# Deployment Guide

This project has two deployable pieces:

1. **Frontend** (`naatu-shop/`) — Vite + React, deployed to **Vercel**, talks directly to **Supabase**. This is the live store.
2. **Backend** (`backend/server/`) — Express + Prisma + Postgres, deployed to **Render**. Legacy API; only needed if you use `VITE_API_URL`.

> If you only want the live store running, you only need the **Vercel** section.

---

## 1. Vercel (frontend — main site)

The root [`vercel.json`](vercel.json) already defines the build commands, so in the dashboard you mainly confirm settings and add env vars.

### Build & Output settings (Settings → General)

| Field            | Value                                              |
| ---------------- | -------------------------------------------------- |
| Framework Preset | **Vite**                                           |
| Build Command    | `cd naatu-shop && npm install && npm run build`     |
| Output Directory | `naatu-shop/dist`                                  |
| Install Command  | *(leave default)*                                  |
| Root Directory   | *(leave as repo root `.`)*                         |

### Environment Variables (apply to Production, Preview, Development)

```
VITE_SUPABASE_URL=https://vxnxwtvchlncedkrijza.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4bnh3dHZjaGxuY2Vka3JpanphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODE5NDEsImV4cCI6MjA5MDg1Nzk0MX0.LZP6o6gfT3IAtFud5izgv7qfOz9M9lEZtclscb8IhOs
VITE_SITE_URL=https://naatu-shop.vercel.app
VITE_WHATSAPP_NUMBER=919514626063
```

Notes:

- The anon key is a **public** client key — safe to expose (it already ships in the JS bundle).
- Set `VITE_SITE_URL` to your real Vercel domain (used for the login/auth redirect).
- **Do NOT** add `SUPABASE_SERVICE_ROLE_KEY` on Vercel — it's a secret used only by local seed scripts.
- Only add `VITE_API_URL` if you actually run the Express backend below. The site uses Supabase directly, so you can skip it.

---

## 2. Render (backend — optional Express API)

The live site runs on Supabase, so this is **optional**. Set it up only if you depend on the Express/Prisma API.

### Service settings (New → Web Service)

| Field          | Value                                |
| -------------- | ------------------------------------ |
| Root Directory | `backend`                            |
| Runtime        | Node                                 |
| Build Command  | `npm install && npx prisma generate` |
| Start Command  | `npm start`                          |

### Environment Variables

```
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<db>?sslmode=require
JWT_SECRET=<a-long-random-secret-string>
CLIENT_ORIGIN=https://naatu-shop.vercel.app
```

Notes:

- **Don't set `PORT`** — Render injects it automatically and the server already reads `process.env.PORT`.
- `DATABASE_URL`: to point at Supabase Postgres, use the connection string from Supabase → Project Settings → Database (use the **Session/pooler** string). Otherwise use the Postgres you provisioned on Render.
- `JWT_SECRET`: generate one, e.g. `openssl rand -hex 32`.
- `CLIENT_ORIGIN`: comma-separated list of allowed frontend origins. `*.vercel.app` is already allowed by the server's CORS config.

---

## Local development

Frontend:

```bash
cd naatu-shop
npm install
npm run dev        # http://localhost:5173
```

Create `naatu-shop/.env.local` (see `naatu-shop/.env.example`) with at least `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

Backend (optional):

```bash
cd backend
npm install
npx prisma generate
npm run dev        # nodemon, http://localhost:5000
```
