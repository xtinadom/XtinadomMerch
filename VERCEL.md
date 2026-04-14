# Deploy on Vercel

This app uses **PostgreSQL** (SQLite is not supported on Vercel serverless). **Neon** is a good default: create a project, set the pooled URL as `DATABASE_URL` and the direct URL as `DIRECT_URL` for local `prisma migrate deploy`.

## Why `npm run build` no longer touches the database

Running `prisma migrate deploy` or `prisma db push` **during** the Vercel build breaks constantly (connection poolers, SSL, cold starts, Prisma engine vs serverless).  

**Default build:** `prisma generate` → `next build` only (Next 16 default bundler). **No DB connection during build.**

You apply the schema **once** (or after schema changes) from your computer using the **same** connection string as production. That is the reliable pattern.

Optional: set **`RUN_PRISMA_SCHEMA_ON_BUILD=1`** in Vercel if you insist on syncing schema during build (you must fix DB URL / pooler issues yourself).

## How Vercel environment variables work

There is **no** separate “Available at Build Time” toggle. For each variable, select **Production** and/or **Preview**; it is available in **both** the build step and runtime for new deployments in that environment. **Redeploy** after edits.

## 1. First-time flow (do this order)

1. **Connect the Git repo** and add env vars (see below).  
2. **Deploy** — the build should go green (no DB in build).  
3. **Apply database schema** (next section) from your laptop.  
4. **Seed** (optional): `npx prisma db seed` with production `DATABASE_URL` / `POSTGRES_PRISMA_URL`.  
5. Open the site.

## 2. Database schema (required — not part of `npm run build`)

From your project folder, with **production** Postgres URL in the environment:

**Option A — paste URL once (simplest)**

In [Vercel](https://vercel.com) → your project → **Settings → Environment Variables**, copy the value of **`POSTGRES_PRISMA_URL`** or **`POSTGRES_URL_NON_POOLING`** (direct is better for migrate).

PowerShell:

```powershell
cd path\to\XtinadomMerch
$env:DATABASE_URL = "paste-copied-url-here"
npx prisma migrate deploy
```

**Option B — Vercel CLI**

```bash
npx vercel login
npx vercel link
npx vercel env pull .env.production.local --environment=production
```

Load that file into your shell (or copy `DATABASE_URL` / `POSTGRES_PRISMA_URL` from it), then `npx prisma migrate deploy`.

**Option C — npm script (recommended after `vercel env pull`)**

Uses Neon's **direct** URL from `.env.production.local` and ignores a local `DIRECT_URL` that sometimes appears in the same file:

```bash
npm run db:migrate:prod
```

If `migrate deploy` fails (e.g. pooled URL only), use:

```powershell
npx prisma db push
```

### Env vars for Postgres (Vercel)

| Name | Purpose |
|------|--------|
| `POSTGRES_PRISMA_URL` | **Runtime** (and CLI fallback) — Vercel Postgres “Prisma” string |
| `DATABASE_URL` | **Runtime** if you set it manually; same idea as above |
| `POSTGRES_URL_NON_POOLING` | **Direct** URL — best for `prisma migrate deploy` from your machine |

`src/lib/prisma.ts` prefers `POSTGRES_PRISMA_URL`, then `DATABASE_URL`.  
`prisma.config.ts` controls CLI (`migrate`, `db push`, `studio`) when run locally.

## 3. What `npm run build` runs

`scripts/vercel-build.cjs`:

1. `npx prisma generate`
2. Schema sync **only if** `RUN_PRISMA_SCHEMA_ON_BUILD=1`
3. `npx next build`

## 4. Seed data (once)

```bash
# After env pull or DATABASE_URL set to production:
npx prisma db seed
```

**Do not** run `prisma db seed` against production — it deletes orders and products.

### Admin catalog list (creator “Request a catalog listing”)

Creators see allowed listing types from **`AdminCatalogItem`** (`Admin` → **List**). If that table is empty, the dashboard shows “No items to add yet.”

- **Manual:** Add rows under **Admin → List** on production (names, variants, minimum prices).
- **If production already has the sample products from `prisma/seed.ts`** (same slugs: `ceramic-mug-photo`, `canvas-print-12`, etc.), you can insert matching admin rows **once** when the list is still empty:

```bash
npx vercel env pull .env.production.local --environment=production
npm run db:seed:admin-catalog-if-empty
```

The script **no-ops** when any admin catalog row already exists. Slugs live in `src/lib/seed-baseline-admin-catalog.ts`.

## 5. Environment variables (Vercel)

**Project → Settings → Environment Variables** → Production (and Preview if needed) → **Redeploy** after edits.

Names and placeholders: **`.env.example`** in the repo. Additional notes:

- **Postgres:** `DATABASE_URL` is usually Neon **pooled**; use a **direct** URL on your laptop for `prisma migrate deploy` (section 2). Runtime also accepts `POSTGRES_PRISMA_URL` / `POSTGRES_URL` (see `src/lib/env-postgres-url.ts`).
- **`SESSION_SECRET`:** at least **32 characters**, required for admin login. The **shop layout** also opens the cart session on every request; without a valid secret the storefront used to 500 while `/` still loaded. Set this in Production (and Preview) on Vercel.
- **Site gate:** set both `SITE_ACCESS_PASSWORD` and `SITE_ACCESS_SECRET`, or leave the gate off.
- **Shop password reset (Resend):** add `RESEND_API_KEY` (from [Resend](https://resend.com) → API Keys). Set `SHOP_PASSWORD_RESET_EMAIL_FROM` to a **verified** address, e.g. `Xtinadom Merch <noreply@auto.xtinadom.com>` when you verify the subdomain **`auto.xtinadom.com`** in Resend (add that exact hostname as a domain and paste Resend’s DNS records where your nameservers live — same as apex, but records are for the subdomain). If `SHOP_PASSWORD_RESET_EMAIL_FROM` is unset, the app uses Resend’s test sender (`onboarding@resend.dev`) — OK for smoke tests only. Set **`NEXT_PUBLIC_APP_URL`** to your live `https://…` site so reset links in email point at Vercel, then **Redeploy**.

**Debug password reset (no secrets in browser):** open `GET /api/health` on production — JSON includes `passwordReset.hasResendApiKey`, `hasShopPasswordResetFrom`, and `linkOrigin` (must match the URL users use). After submitting forgot-password, check **Vercel → project → Logs** (filter `shop-password-reset`): you’ll see either “No ShopUser…” (email not in DB), Resend HTTP errors with body, or “Resend accepted email id=…” then confirm delivery in **Resend → Emails / Logs**. If the UI shows an error starting with `Email could not be sent`, that text is forwarded from Resend’s API message.
- **Stripe webhook:** URL in section 6.

## 6. Stripe webhook

[Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks) → endpoint:

`https://<your-domain>/api/webhooks/stripe`

## 7. Custom domain & HTTPS (padlock / “not secure” / scam warnings)

Browsers show **HTTPS** only when **TLS is terminated correctly** for the hostname you’re visiting. That is almost always **DNS + Vercel**, not application code.

1. **Vercel → Project → Settings → Domains**  
   Add **both** `www.yourdomain.com` and `yourdomain.com` (or whichever you use). Wait until each row shows **Valid Configuration** (not “Invalid” or “Pending”).

2. **DNS at your registrar** (or DNS host) must match **exactly** what Vercel shows for each domain (CNAME / A / ALIAS). If traffic goes to the wrong place, you get **no certificate** or the wrong site → address bar shows **Not secure**.

3. **`NEXT_PUBLIC_APP_URL`** must be your real public URL with **`https://`** (e.g. `https://www.yourdomain.com`). Never `http://` in production.

4. **Cloudflare in front of Vercel**  
   SSL/TLS mode must be **Full** or **Full (strict)** — **not** “Flexible” (that can break HTTPS between Cloudflare and Vercel and confuse browsers).

5. After DNS changes, allow propagation (often minutes, sometimes longer), then open `https://www.yourdomain.com` in a private window.

The app also **redirects HTTP → HTTPS** in production and sends **HSTS** on production deployments; that only helps once requests actually reach your Vercel deployment with a valid certificate.

## Local development

```bash
docker compose up -d
# .env: DATABASE_URL → local Postgres (see .env.example)
npx prisma migrate deploy
npm run db:seed
npm run dev
```

`npm run db:seed` also fills **Admin → List** baseline rows for the sample products when you reset locally.

`npm run build` locally matches Vercel: **no DB** unless `RUN_PRISMA_SCHEMA_ON_BUILD=1`.
