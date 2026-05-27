# Investor Ensights

A programmatic-SEO publishing platform providing financial insights on local company formation and equity activity for institutional and retail investors.

## Run & Operate

*   **Install dependencies**: `npm install`
*   **Run dev server**: `npm run dev`
*   **Build**: `npm run build`
*   **Typecheck**: `npm run typecheck`
*   **Generate Drizzle Kit types**: `npm run db:generate`
*   **Push schema to dev DB**: `npm run db:push`
*   **Push schema to prod DB**: `bash scripts/push-schema-to-prod.sh` (now also propagates additive changes to every `tenant_<slug>` schema via `scripts/sync-tenant-schemas.mjs --prod`)
*   **Sync tenant schemas only (after `npm run db:push`)**: `node scripts/sync-tenant-schemas.mjs` (dev) or `--prod` (prod). Use `--dry-run` to preview.
*   **Sync Dev to Prod data**: `npx tsx scripts/sync-dev-to-prod.ts --confirm` (use `--confirm` for actual writes)
*   **Backfill Tableicity SEO meta (one-shot, MT-4.12.7 — already executed on PROD 2026-05-13, 76 rows locked)**: `npx tsx scripts/backfill-tableicity-meta.ts [--prod] [--confirm] [--expected=N] [--force]`. Default = dev + dry-run. Idempotent (skips rows where `meta_locked_at IS NOT NULL`); `--force` only for Conductor-approved re-locks. Pure meta-only UPDATE — does not touch `updated_at` / `date_modified` so sitemap last-mod stays content-driven.

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

**MT-4.13.4 SHIPPED (new SERP-fit meta contract: brand-out-of-title, "80/20" description):**

*   **Why:** the MT-4.13.3 naturalizer produced 81-87 char titles — Google truncates SERPs at ~60. And the existing formula descriptions read like door-hangers (brand at the front). Conductor decision: drop the brand from the title entirely (H1, canonical URL, and description carry it; title doesn't need to), and shape the description as 80% content + 20% brand accent.
*   **New title contract:** target 55, hard max 65. MUST contain city verbatim. MUST NOT contain the persona display name. Formula safety net is now `${city}, ${state}: ${haylo title trimmed}` — no brand prefix.
*   **New description contract:** target 150, range 100-200. MUST contain city + brand verbatim. Brand mentioned 1-2 times, NEVER inside the first 40 characters (that's the "lead with content, not the brand" guard). Formula safety net puts the brand attribution at the end (`...${brand} helps ${city} founders.`).
*   **Two new acceptance helpers in `lib/newsroom/brandContext.ts`:** `metaTitleAcceptable()` and `metaDescriptionAcceptable()` — both return null on pass, or a short reason string. Used by both the orchestrator's Tier-1 gate AND the naturalizer's Tier-2.5 validation, so the gates are guaranteed identical. Legacy `metaContainsBrandAndCity` is kept for any caller that still needs the strict pre-MT-4.13.4 check.
*   **Naturalizer is now two-shot:** if the first attempt fails any guard, we feed the rejection reason back to the LLM with a stricter retry prompt (temperature drops 0.6 → 0.3). Worst-case cost ~$0.0006/article instead of $0.0003. Falls open to the formula if BOTH attempts fail (still never throws).
*   **Constants exported from `pairProcessor.ts`:** `META_LIMITS` and `META_DESCRIPTION_BRAND_LEAD_GUARD_CHARS` so the admin preview route + naturalizer share one source of truth.
*   **Backfill behavior unchanged** — running `scripts/backfill-tableicity-meta.ts --prod --naturalize --confirm --force` re-stamps every published row through the new contract. Polished output stamped `meta_source='naturalized'`; formula safety-net stamped `meta_source='fallback'`.

**MT-4.13 history (collapsed — all SHIPPED, superseded by MT-4.13.4):**

*   **MT-4.13.1 — Haylo-first Persona Wizard.** Wizard restructured to 4 steps (Identity → Haylo + Brand → Cities → Finish). Brand voice is no longer hand-typed; it's *derived* from a pasted Haylo essay by `POST /api/admin/personas/derive-brand` (gpt-4.1-mini, ~$0.001/derive, audited as `persona.brand.derived`). Step 1 is staff-minimal (slug + display name + publisher + author + legal company + slug-confirm next to Create). Step 2 has paste-essay + derive on the left, Haylo Source card + Live SEO Preview on the right, editable brand form below with soft-warning under 0.6 confidence. Step 3 adds a CSV template download. Persona row exists after Step 1; deep-link `?slug=…&step=N` resumes from `/admin/personas`. Brand placeholder pattern: `(pending Haylo derive)` strings written when Step 1 lands without brand fields; `readiness.brand.complete` treats placeholders as incomplete.
*   **MT-4.13.2 — Brand-mention guard in newsroom pipeline.** The public article renderer (`app/discovery/knowledge/[slug]/page.tsx::highlightBrandInBody`) wraps the first body occurrence of `tenants.persona_display_name` with the brand-home backlink; if the LLM body never mentions the persona name, the backlink silently disappears (two May-2026 articles shipped this way). Guard added in `lib/newsroom/pipelineWorker.ts::runPipeline` after copywriter sanitization, BEFORE `composeDraftFromOutputs` — word-boundary `\bpersonaDisplayName\b` test on `bodyHtml`; on miss, the run throws and the job is marked `failed`. Covers both pipeline entry points (`runLivePipeline` + Pair-agent orchestrator). Headline / subheadline mentions are NOT counted. Two pre-existing brand-less articles unfixed (forward-only deletes rule).
*   **MT-4.13.3 — Tier-2.5 LLM meta naturalizer (initial version).** Introduced `lib/newsroom/metaNaturalizer.ts` (single-call gpt-4.1-mini polish, ~$0.0003/article), the `meta_source='naturalized'` value (`varchar(16)`, no migration), and the `--naturalize` flag on `scripts/backfill-tableicity-meta.ts`. Wired into the Pair orchestrator's Tier-2 branch. **Superseded by MT-4.13.4** — the original prompt produced 81-87 char titles (Google truncates ~60); MT-4.13.4 rewrote the contract, the guards, and made the naturalizer two-shot. The module name, the `'naturalized'` value, and the `--naturalize` flag all carry forward unchanged.

**MT-4.13 SHIPPED (Persona Wizard, staff-proof tenant onboarding):**

*   New Conductor-only `/admin/personas` list + `/admin/personas/new` 3-step Wizard (Identity & Brand → City Batch → Haylo essays). Adding a persona no longer requires SQL access.
*   Atomic create — `POST /api/admin/personas` runs `INSERT public.tenants` + `provisionTenantSchemaWithClient` inside a single pg transaction; failure leaves the system byte-identical.
*   Slug is a one-way door: client + server both require a re-typed `confirmSlug` before the tx runs.
*   Server-driven readiness gates — `GET /api/admin/personas/[slug]/readiness` returns brand-complete bool, city count, haylo count, and `cities.groundingGateOpen` (≥1 enabled `city_research_sources`). Wizard "Continue" / "Finish" buttons disable on the live readiness payload, not client state. `publishReady = brand && cities ≥ 1 && haylo ≥ 1`; the research-source grounding gate remains a soft warning (per-city auto-seeder still pending; MT-4.13.1 instead pivoted to LLM-derived brand voice).
*   Live SEO preview at the brand step uses the SAME `buildMetaTitle` / `buildMetaDescription` builders the live pair pipeline uses (`POST /api/admin/personas/preview-meta`).
*   Cross-tenant Wizard endpoints (`POST /api/admin/personas/[slug]/cities/bulk-csv`, `POST /api/admin/personas/[slug]/haylo`) wrap the same `storage` interface inside `withTenantAsync(targetSlug, …)` so the Conductor seeds without a session swap.
*   Conductor gate (`lib/conductor-guard.ts`): membership check against `CONDUCTOR_TENANT_SLUG` (env, default `tableicity`). Every persona endpoint calls `requireConductor()` → 403 for non-Conductor. `/api/admin/me` now returns `isConductor`; sidebar "Personas" entry conditionally renders.
*   Cross-tenant `PATCH /api/admin/tenants/[slug]` is now Conductor-gated (same-tenant edits unchanged) and exposes `brandVertical` / `brandTagline` / `brandFeatureCta`.
*   Every Wizard write logs via `logAuditEvent` into the actor's tenant log (`persona.create`, `persona.upload.cities`, `persona.upload.haylo`).
*   "Auto-lock SEO meta on publish" checkbox was a deliberate disabled stub on the original brand step; **removed in MT-4.13.1** (no longer in the wizard) and will be re-introduced on a tenant settings page when MT-4.14 wires it up.

**Locked decisions (MT-0):**

*   **Isolation:** Schema-per-tenant via PostgreSQL `search_path`. Public schema for platform tables, `tenant_<slug>` schema for per-tenant tables.
*   **Tenant context:** Session-derived. Each user belongs to exactly one tenant via `tenant_members`. **No tenant-picker UI**, no subdomain, no path prefix on admin routes.
*   **Persona slug = schema name = article slug prefix.** One string, three roles. `tableicity` → `tenant_tableicity` schema → `/discovery/knowledge/tableicity-…`.
*   **City URL namespace = global**, enforced by `public.city_slug_registry`. Existing 340 Tableicity city slugs preserved. New tenants assign unique slugs at City Batch Upload.
*   **Article URL namespace = globally unique by construction** (persona prefix). No registry table needed.
*   **Auth (v1.1):** `users` (platform) + `tenant_members` (binding). Email + password + 6-digit MFA two-phase login. **No OAuth providers.** **Public self-serve tenant creation:** "Create one" link on `/login` → `/login/set-password` atomically creates user + tenant + schema + member. MFA codes written to server logs (`mfa.code.issued`); the Lab Code page on `/login/verify` reads the most recent code and displays it in a Lab Mode box. AWS SES integration deferred to a post-MT-9 sub-gate.
*   **Three auth pages, single layout (v1.1):** `/login` (Sign In), `/login/set-password` (Create Account), `/login/verify` (Lab Code). All three use form LEFT (white panel) + brand RIGHT (black panel with large `iE` wordmark). Returning-user flow = 2 pages; new-user flow = 3 pages; both converge at `/login/verify`. Landing page (`/`) untouched.
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
*   **Sitemap-as-canary**: Live PROD `investorensights.com/sitemap.xml` should grow monotonically. Baseline as of 2026-05-27 (post E-E-A-T author rollup + `/about` page) = **105 URLs** (89 published articles + persona hubs + orphan + locations grid + `/about` + static). A SHRINK below the latest baseline is the alarm. Update this number whenever you intentionally publish or remove a batch.
*   **Dev vs. Prod DB**: Dev and Prod use separate Postgres databases. Always run the sync workflow (`scripts/sync-dev-to-prod.ts`) before publishing to propagate data changes.
*   **Schema-per-tenant drift**: `npm run db:push` and `drizzle-kit push` only touch the `public` schema. After ANY schema change, also run `node scripts/sync-tenant-schemas.mjs` (dev) so each `tenant_<slug>` copy gets the new columns / relaxed nullability / new indexes. `bash scripts/push-schema-to-prod.sh` does this automatically for prod. Symptom of skipping it: pages quietly show "0 results" because Drizzle SELECT references a column that doesn't exist in the active tenant schema.
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