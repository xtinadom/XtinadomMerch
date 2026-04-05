# Deploy on Vercel

This app uses **PostgreSQL** (SQLite is not supported on Vercel serverless).

## 1. Database

Create a Postgres database and get a connection string (SSL usually required):

- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) (integrates in the Vercel dashboard), or  
- [Neon](https://neon.tech), [Supabase](https://supabase.com), etc.

In the Vercel project, add environment variables for Postgres:

| Name | Value |
|------|--------|
| `DATABASE_URL` | App runtime (optional if you use Vercel’s Postgres envs below) |
| `POSTGRES_PRISMA_URL` | **Vercel Postgres**: pooled URL for the app (checked first at runtime in `src/lib/prisma.ts`) |
| `POSTGRES_URL_NON_POOLING` | **Vercel Postgres**: direct URL — used first for `prisma migrate deploy` during build |
| `DIRECT_URL` or `DATABASE_URL_UNPOOLED` | Neon / others: direct URL for migrations |

Neon and poolers **fail migrations** if only a pooled URL is set. Add a direct URL (`DIRECT_URL` or `POSTGRES_URL_NON_POOLING`).

This repo resolves URLs in `prisma.config.ts` (migrate) and `src/lib/prisma.ts` (runtime); fallbacks include `POSTGRES_URL` and `PRISMA_DATABASE_URL`.

Each deploy runs `prisma migrate deploy` as part of **`npm run build`** and applies `prisma/migrations`.

## 2. Seed data (once)

After the first successful deploy, seed categories and sample products from your machine (or Vercel CLI shell) with the **same** `DATABASE_URL`:

```bash
npx prisma db seed
```

## 3. Required environment variables

Copy from `.env.example` and set every variable in **Vercel → Project → Settings → Environment Variables** for *Production* (and *Preview* if you use previews):

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL` — e.g. `https://www.xtinadom.com` (or your Vercel URL until the domain is attached)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `SESSION_SECRET` (32+ random characters)
- `ADMIN_PASSWORD`
- `PRINTIFY_*` if you use Printify
- `SHIPPING_FLAT_CENTS`
- Optional gate: `SITE_ACCESS_PASSWORD`, `SITE_ACCESS_SECRET` (omit both to disable)
- Optional: `NEXT_PUBLIC_MERCH_QUOTE_EMAIL`

## 4. Stripe webhook

In [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks), add an endpoint:

`https://www.xtinadom.com/api/webhooks/stripe`

(use your real domain or `https://<project>.vercel.app/...` while testing)

## 5. Connect the Git repo

[Vercel → Add New → Project](https://vercel.com/new) → import `xtinadom/XtinadomMerch` → deploy.

## 6. Custom domain

Project → **Settings → Domains** → add `www.xtinadom.com` and `xtinadom.com` (DNS instructions appear in the dashboard). Keep `NEXT_PUBLIC_APP_URL` aligned with the canonical URL (`https://www.xtinadom.com`).

## Local development

```bash
docker compose up -d
# Set DATABASE_URL in .env to postgresql://postgres:postgres@localhost:5432/xtinadom_merch
npx prisma migrate deploy
npm run db:seed
npm run dev
```

`npm run build` locally also needs `DATABASE_URL` because Next may load modules that connect to Prisma.
