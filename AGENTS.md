<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Prisma

When a task adds or changes `prisma/schema.prisma` and includes new or updated files under `prisma/migrations/`, run **`npx prisma migrate deploy`** after those changes (with a valid `DATABASE_URL` / `POSTGRES_PRISMA_URL`). Run **`npx prisma generate`** when the schema or client output changes. Bump `PRISMA_SINGLETON_STAMP` in `src/lib/prisma.ts` if the generated client shape changes so dev does not keep a stale singleton.
