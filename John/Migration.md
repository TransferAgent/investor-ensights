# Dev vs Production Migration Guide

## The Core Problem

Dev and production use **separate databases** but the same codebase. Features built in dev that create data through the admin UI (templates, campaigns, seed records) only exist in the dev database. When you publish, the code deploys but the production database doesn't have that data.

**Result:** Features appear broken in production — not because of code issues, but because the data they depend on doesn't exist there.

---

## The Solution: Migration Pipeline

Every deploy should run this sequence automatically:

```
Schema Sync → Data Migration → Build → Deploy
```

This is implemented in `script/build.ts`:

1. **`npx drizzle-kit push --force`** — Syncs any new tables or columns to the production database
2. **`npx tsx script/migrate-data.ts`** — Creates any reference data (templates, campaigns, etc.) that must exist in production
3. **`npx next build`** — Compiles the app (static pages will query the now-updated production DB)
4. **Copy static assets** — Moves public/ and .next/static/ into standalone output

---

## Rules for Every New Feature

### Rule 1: If you create data through the UI, write a migration

Any time a feature depends on specific records existing (templates, campaigns, configuration records), that data must be scripted in `script/migrate-data.ts`.

**Bad:** Creating a template through the admin panel and assuming it'll be in production.

**Good:** Adding the template to `migrate-data.ts` with an idempotent check:

```typescript
const existing = await db.select().from(table).where(eq(table.name, "My Template"));
if (existing.length === 0) {
  await db.insert(table).values({ ... });
}
```

### Rule 2: Always make migrations idempotent

Every migration should check if the data already exists before creating it. This way it's safe to run on every deploy without duplicating records.

### Rule 3: Schema changes need `db:push` before build

If you add a new column or table to `shared/schema.ts`, the production database won't have it. The `drizzle-kit push --force` step in the build handles this automatically.

### Rule 4: Test the full build locally before publishing

Run `npm run build` locally before suggesting a publish. This catches:
- Missing columns in the database
- Import errors in server-rendered pages
- Static page generation failures

---

## Checklist Before Publishing

- [ ] Did we add any new tables or columns? → Schema sync will handle it
- [ ] Did we create any data through the admin UI that features depend on? → Add to `migrate-data.ts`
- [ ] Does `npm run build` complete without errors locally?
- [ ] Are all new API routes tested with real data?

---

## Key Files

| File | Purpose |
|------|---------|
| `script/build.ts` | Build pipeline (schema sync → migration → build) |
| `script/migrate-data.ts` | Production data migrations (templates, campaigns, etc.) |
| `shared/schema.ts` | Database schema (Drizzle ORM) |
| `lib/seed.ts` | Initial seed data (only runs on empty databases) |
| `drizzle.config.ts` | Drizzle configuration |

---

## Lessons Learned (Tableicity Build)

1. **Campaign system:** Added `campaign_id` column to schema but didn't push to production → build failed with "column does not exist"
2. **PR Hash-256 template:** Created through API in dev, didn't exist in production → Templates tab showed only the old template
3. **Campaign assignment:** 45 articles assigned to campaign in dev, but production articles had no campaign → flat list instead of grouped view

All three were resolved by adding schema sync and data migration to the build pipeline.

---

## For Future SAAS Projects

Start every new project with this build pipeline from day one:

1. Copy `script/build.ts` pattern (schema sync + migration + build)
2. Create `script/migrate-data.ts` from the start
3. Add to it every time you create reference data through the UI
4. Always run `npm run build` before publishing to catch issues early
