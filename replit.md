# Investor Ensights

A programmatic-SEO publishing platform providing financial insights on local company formation and equity activity for institutional and retail investors.

## Run & Operate

*   **Install dependencies**: `npm install`
*   **Run dev server**: `npm run dev`
*   **Build**: `npm run build`
*   **Typecheck**: `npm run typecheck`
*   **Generate Drizzle Kit types**: `npm run db:generate`
*   **Push schema to dev DB**: `npm run db:push`
*   **Push schema to prod DB**: `bash scripts/push-schema-to-prod.sh`
*   **Sync Dev to Prod data**: `npx tsx scripts/sync-dev-to-prod.ts --confirm` (use `--confirm` for actual writes)

**Required Environment Variables**: `DATABASE_URL`, `PROD_DATABASE_URL`, `SESSION_SECRET`, `NEXT_PUBLIC_BASE_URL`, `OPENAI_API_KEY`, `OPENCAGE_API_KEY`, `CRON_SECRET`, `NEWSROOM_WORKER_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY`, `ADMIN_PURGE_OTHERS`.

## Stack

*   **Framework**: Next.js 16 (App Router)
*   **Runtime**: React 18 (TypeScript)
*   **Styling**: Tailwind CSS 3, shadcn/ui
*   **ORM**: Drizzle ORM, drizzle-zod
*   **Data Fetching**: TanStack React Query (admin side)
*   **Build Tool**: Next.js

## Where things live

*   **Public pages**: `app/locations/[slug]`, `app/discovery/knowledge/[slug]`, `app/[slug]` (custom pages), `app/terms`, `app/privacy`, `app/site-map` (human-readable sitemap; XML sitemap is at `app/sitemap.ts` → `/sitemap.xml`)
*   **Admin dashboard**: `app/admin/*`
*   **API routes**: `app/api/*`
*   **DB Schema**: `shared/schema.ts`
*   **Sitemap generation**: `app/sitemap.xml/route.ts` (route handler — emits clean public-cacheable XML, no cookies; see `Site_Map.md` §12)
*   **Robots.txt**: `app/robots.ts`
*   **Main Configuration**: `next.config.js`, `tailwind.config.ts`, `drizzle.config.ts`
*   **Helper scripts**: `scripts/*`
*   **Middleware**: `middleware.ts`
*   **Favicon**: `app/icon.png`
*   **Publisher Logo**: `public/investor-ensights-logo.png`
*   **LLM Prompts**: `config/localVibePrompts.ts`

## Multi-Tenant Architecture (in progress, see `John/Locked_Gate_Table_MultiTenant_v1.0.md`)

**Project model:** Investor Ensights is the Conductor's private internal Newsroom workshop, not a public SaaS. Each Persona/Tenant = one of the Conductor's brands publishing through the same domain. Tableicity is the first tenant; existing 80 articles + 340 cities + 182 haylo + all newsroom state migrate **untouched** into `tenant_tableicity` schema.

**Locked decisions (MT-0):**

*   **Isolation:** Schema-per-tenant via PostgreSQL `search_path`. Public schema for platform tables, `tenant_<slug>` schema for per-tenant tables.
*   **Tenant context:** Session-derived. Each user belongs to exactly one tenant via `tenant_members`. **No tenant-picker UI**, no subdomain, no path prefix on admin routes.
*   **Persona slug = schema name = article slug prefix.** One string, three roles. `tableicity` → `tenant_tableicity` schema → `/discovery/knowledge/tableicity-…`.
*   **City URL namespace = global**, enforced by `public.city_slug_registry`. Existing 340 Tableicity city slugs preserved. New tenants assign unique slugs at City Batch Upload.
*   **Article URL namespace = globally unique by construction** (persona prefix). No registry table needed.
*   **Auth:** `users` (platform) + `tenant_members` (binding). Email 6-digit MFA two-phase login. `DEV_MFA_BYPASS=000000` permitted in dev only. **No public signup route** — admin-only tenant creation.
*   **Three auth pages × two layouts:** `/login`, `/login/verify`, `/login/set-password` use Layout B (form LEFT, branding RIGHT). Landing page (`/`) keeps Layout A (branding LEFT, form RIGHT).
*   **Per-tenant brand chrome:** `authorName`, `publisherName`, prompt voice come from tenant config. Tableicity seeded with existing strings — zero content drift.
*   **No per-persona marketing pages** on `investorensights.com`. Newsroom publishes their content under the iE domain only.
*   **New tenants start truly empty** — no city seed, no content seed. Conductor uploads City Batch + Halo library separately.

**Global vs per-tenant tables:**

*   **Global (`public`):** `users`, `tenants`, `tenant_members`, `email_verifications`, `city_slug_registry`, `session`, `admin_users` (deprecated post-MT-4)
*   **Per-tenant (`tenant_<slug>`):** `admin_audit_log`, `city_locations`, `city_content_assignments`, `city_research_sources`, `knowledge_articles`, `knowledge_article_versions`, `knowledge_templates`, `knowledge_campaigns`, `knowledge_generation_log`, `content_templates`, `custom_pages`, `page_slides`, `haylo_articles`, `newsroom_*` (9 tables), `data_store_files`

## Architecture decisions

*   **Content Generation Pipeline**: Uses a 5-agent model (Researcher, Data Analyst, Local Copywriter, SEO QC, Internal Linker) for generating press releases, optimized for cost and speed with parallel execution.
*   **Haylo Content Integration**: Specific parsing and styling adjustments for Haylo Lab HTML to preserve key elements while stripping redundant tags.
*   **Article Lead-Paragraph Deduplication**: Implemented `removeDuplicateLeadParagraph()` to prevent redundant lead paragraphs, handling exact, fuzzy, and prefix matches, with tag-stack awareness for HTML integrity.
*   **Scheduler Picker Grounding Gate**: Requires cities to have at least one enabled `city_research_sources` entry before being eligible for the auto-scheduler, preventing ungrounded content generation.
*   **Admin User Management Security**: Atomic last-admin delete prevention and rate-limiting for admin user management endpoints.

## Product

*   **Dynamic City Landing Pages**: City-specific content, slideshows, contact info, maps.
*   **Locations Grid**: Search, filter, and geo-detection for city listings.
*   **Custom Page Builder**: For creating custom public-facing pages.
*   **SEO-Optimized Knowledge Articles**: Public press releases with JSON-LD, OpenGraph, dynamic sitemaps, and robots.txt support.
*   **Comprehensive Admin Dashboard**: CRUD for cities, content templates, custom pages, knowledge articles, bulk operations, and user management.
*   **Newsroom Auto-Scheduler**: Configurable drip publishing of content using the 5-agent pipeline.
*   **Haylo Library**: Ingestion, duplicate detection, status management, and sandboxed previews for Haylo Lab essays.

## User preferences

Preferred communication style: Simple, everyday language.

## Gotchas

*   **Forward-only deletes**: Standing rule from the recovery era and carried into multi-tenant. No retroactive deletes of slugs, audit rows, or content without Conductor sign-off. `apply-noindex-baseline` and `seo-visibility` routes were removed for this reason; do not reintroduce park-everything-to-noindex sweepers.
*   **Never touch article slugs**: All 80 published article slugs contain intentional `tableicity-` persona tokens (verified). These are SEO-protected. Multi-tenant build preserves them by construction (D5 in the gate table).
*   **Sitemap-as-canary**: Live PROD `investorensights.com/sitemap.xml` should return 84 URLs (80 articles + 4 static) at every multi-tenant gate close until intentionally changed. Divergence = stop work and investigate.
*   **Dev vs. Prod DB**: Dev and Prod use separate Postgres databases. Always run the sync workflow (`scripts/sync-dev-to-prod.ts`) before publishing to propagate data changes.
*   **Sitemap Refresh**: New articles from the Newsroom scheduler are eventually consistent in the sitemap; a redeploy forces a fresh sitemap. Always resubmit the sitemap in Google Search Console after deployment.
*   **Hardcoded URLs/Brand**: Several internal files contain hardcoded `tableicity.com` URLs or `"Tableicity"` brand strings that need manual updates for regional forks.
*   **US-centric Schema/Seeder**: `city_locations` schema is US-centric (`state_code`) and the `cityResearchAutoSeeder` targets US-based sources; requires modification for EU or other regions.
*   **GDPR/Data Residency**: For EU deployments, ensure cookie consent, database hosting, OpenAI, and OpenCage usage comply with GDPR, and audit log data is managed appropriately.

## Pointers

*   **Next.js Documentation**: [https://nextjs.org/docs](https://nextjs.org/docs)
*   **Drizzle ORM Documentation**: [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
*   **Tailwind CSS Documentation**: [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
*   **shadcn/ui Documentation**: [https://ui.shadcn.com/docs](https://ui.shadcn.com/docs)
*   **TanStack Query Documentation**: [https://tanstack.com/query/latest/docs/react/overview](https://tanstack.com/query/latest/docs/react/overview)
*   **OpenCage Geocoding API**: [https://opencagedata.com/](https://opencagedata.com/)
*   **OpenAI API Documentation**: [https://platform.openai.com/docs/api-reference](https://platform.openai.com/docs/api-reference)
*   **EU Handoff Notes**: `John/EU_Handover.md` (for marketing/UX overview of platform)