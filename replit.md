# replit.md

## Overview

This project is a **City Landing Page Manager**, a full-stack web application designed for programmatic SEO. It enables the creation and management of location-based landing pages for various US cities using reusable content templates with dynamic placeholder substitution. The application provides a public-facing website for browsing city locations and templated content, as well as an admin dashboard for managing cities, content templates, and their assignments. Its core purpose is to automate content generation and deployment for location-specific marketing.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application is built with **Next.js 16** (App Router), **React 18** (TypeScript), **Tailwind CSS 3** for styling, and **shadcn/ui** for UI components. Data fetching on the admin side is handled by **TanStack React Query**.

**UI/UX Decisions:**
The public-facing site features dynamic city landing pages and a locations grid with search, filter, and geo-detection. Custom pages can be created via a Page Builder, and public press release/knowledge articles have full SEO support (JSON-LD, OpenGraph, dynamic sitemaps, robots.txt). The admin dashboard provides comprehensive CRUD operations and management tools. Styling leverages Tailwind CSS and shadcn/ui components for a consistent and modern interface.

**Technical Implementations & Feature Specifications:**

*   **Public-facing Pages:**
    *   Dynamic city landing pages (`/locations/[slug]`) with city-specific content, slideshows, contact info, and maps.
    *   Locations grid (`/locations`) with search, filter, and geo-detection.
    *   Custom pages (`/[slug]`) created via an integrated Page Builder.
    *   Public press release/knowledge articles (`/discovery/knowledge/[slug]`) with SEO optimizations.
*   **Admin Dashboard:**
    *   User authentication with JWT and httpOnly cookies.
    *   CRUD for cities, content templates, custom pages, and knowledge articles.
    *   Bulk operations for cities (CSV import, publish/unpublish, template assignment).
    *   Page Builder for custom pages with configurable content slides.
    *   "Knowledge" section for managing press releases, including a content studio with a 5-agent pipeline (Researcher, Data Analyst, Local Copywriter, SEO QC, Internal Linker) for content generation and management.
    *   **Newsroom Auto-Scheduler:** Configurable scheduler for drip publishing using the 5-agent pipeline, selecting eligible `haylo_articles` and `city_locations` for pairing and publishing.
    *   **Pair-Agent Orchestration (`pairAgentOrchestrator.ts`):** The "Pair" Newsroom flow runs a Haylo essay through the full 5-agent pipeline in polish mode (prompt version `v4`) instead of the prior glue+grade shortcut. The Copywriter receives `hayloSeed` (title, bodyHtml, dateline, topicSlug) via `extras` and is instructed to preserve the Haylo body's structure, polish the title, normalize emphasis, and emit a single clean dateline. Verdicts: PASS ≥75 → publishes to `knowledge_articles`, WARN 50-74 → review queue, FAIL <50 → blocked. Dry-run path bypasses LLMs and falls through to the legacy `processPair` mock.
    *   **City Research Auto-Seeder (`cityResearchAutoSeeder.ts`):** Before each Pair run, `ensureCitySources(citySlug)` checks for enabled rows in `city_research_sources`; if none exist, derives candidate URLs from city/state metadata (Wikipedia, city.gov, Chamber, Crunchbase), probes them, and caches productive ones via `INSERT … ON CONFLICT DO NOTHING`. Idempotent and never stalls on dead URLs.
    *   **Scheduler Picker Grounding Gate (`schedulerPicker.ts`):** Both `pickNextPair` and `countEligiblePairs` require the candidate city to have at least one row in `city_research_sources` with `enabled = true`. Cities with zero seed sources are skipped entirely — preventing the cron from repeatedly picking ungrounded cities and erroring on the v4 "requires fetched sources" guard. To make a city eligible, add at least one enabled source via `POST /api/admin/cities/[id]/research-sources` (or the matching admin UI when present). Manual `/admin/newsroom/pair` runs bypass the picker and still rely on the auto-seeder.
    *   Data store for managing file uploads.
    *   **Admin Users management (`/admin/settings/admins`):** Self-service page to list admins, create new admins, change any admin's password (12-char min), and delete admins. Backed by `app/api/admin/users` (GET/POST) and `app/api/admin/users/[id]` (PATCH/DELETE). All endpoints require `verifySession`. Self-delete is blocked. Last-admin delete is blocked atomically inside a Postgres transaction (`SELECT … FOR UPDATE` on `admin_users` then conditional delete) to defeat TOCTOU races. POST/PATCH/DELETE are rate-limited per session via `checkRateLimit` (5 / 15 min window). Passwords are hashed with the existing scheme (`randomBytes(16).toString("hex") + ":" + scryptSync(pw, salt, 64).toString("hex")`); plaintext is never logged or returned. Audit log records `create`, `update` (`{field:"password"}`), and `delete` actions on `admin_user`. Dev-side seeding helper: `scripts/upsert-super-admin.ts` (env: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY`, `ADMIN_PURGE_OTHERS`).
    *   **Haylo Library (`/admin/haylo`):** Allows ingestion of Haylo Lab essays via paste-in or file-drop, with duplicate detection, status management (`ready`/`draft`/`retired`), and sandboxed previews.
*   **SEO Enhancements:** Server-Side Rendering (SSR), dynamic sitemap and robots.txt, canonical URLs, OpenGraph tags, and JSON-LD structured data.
*   **Authentication & Security:** JWT-based authentication with `scrypt` hashing, httpOnly cookies, rate limiting, input sanitization, SQL injection protection via Drizzle ORM, and admin audit logging.
*   **Geocoding:** Integration with OpenCage API for automatic latitude/longitude population.

**System Design Choices:**

*   **Database:** PostgreSQL, accessed via Drizzle ORM and `drizzle-zod`.
*   **Content Generation Pipeline:** The Newsroom pipeline uses a refined 5-agent model for generating press releases, focusing on source-grounded content. This pipeline has been optimized for cost and speed, including parallel execution of certain stages.
*   **Haylo Content Integration:** Specific adjustments were made to correctly parse and style Halo Lab's HTML format, preserving key elements like `<strong>` tags and `answer-block` paragraphs while stripping redundant `<h1>` tags for optimal display on public pages.
*   **Performance Tuning:** The live pipeline model was upgraded to `gpt-4.1-nano` for improved speed and cost efficiency. Pipeline stages are grouped for parallel execution where dependencies allow.
*   **Article Lead-Paragraph Deduplication (`app/discovery/knowledge/[slug]/page.tsx`):** The dek (italic sub-paragraph) under each article headline is rendered from `metaDescription` (or `subheadline` as fallback). Many AI-generated bodies open with the same sentence as the dek, so `removeDuplicateLeadParagraph()` strips duplicates from the first non-`answer-block` `<p>` in three modes:
    1.  Exact match → drop the whole paragraph.
    2.  Fuzzy match (≥85% length ratio with shared 80-char prefix) → drop the whole paragraph.
    3.  **Prefix match** → the dek is the opening sentence(s) of a longer paragraph; only the dek-shaped prefix is removed and the rest of the paragraph (with all inline markup) is preserved.
    The prefix-strip helper (`stripDekPrefixFromInnerHtml`) is tag-stack-aware (refuses to cut inside an open `<strong>`/`<em>`/etc. so it never produces unbalanced HTML), decodes HTML entities (`&nbsp;`, `&amp;`, smart quotes, numeric entities) so normalization aligns with `normalizeForCompare`, and **requires a hard sentence boundary** (`.`/`!`/`?`) immediately after the matched prefix to avoid decapitating a longer sentence that merely opens with dek-shaped text. Output then flows through `rechunkParagraphs` and `highlightBrandInBody` as before.

## Pre-Publish Dev → Prod Sync

**Important:** Dev and Prod use **separate** Postgres databases:
*   Dev → Replit Helium (`heliumdb`), connected via `DATABASE_URL`.
*   Prod → Neon (`neondb`), connected via the `PROD_DATABASE_URL` secret.

Whenever the user says they intend to publish, run the sync workflow first so that any data changes (admins, cities, articles, scheduler config, etc.) made in Dev land in Prod before the deploy goes live.

**Schema first (only when columns/tables changed):**
```
bash scripts/push-schema-to-prod.sh
```
Runs `drizzle-kit push --force` against `PROD_DATABASE_URL`.

**Then mirror data Dev → Prod:**
```
npx tsx scripts/sync-dev-to-prod.ts            # dry run, no writes
npx tsx scripts/sync-dev-to-prod.ts --confirm  # mirror Dev into Prod
```

`scripts/sync-dev-to-prod.ts` safety features:
*   Refuses to run if `DATABASE_URL` and `PROD_DATABASE_URL` resolve to the same host+db.
*   Computes FK dependency order dynamically from `information_schema` (parents inserted before children).
*   Wraps the entire mirror in a single transaction on Prod (rollback on any error).
*   `TRUNCATE … RESTART IDENTITY CASCADE` on every table before insert; resets sequences for any serial columns afterward.
*   Stringifies `json`/`jsonb` values to avoid node-pg array-literal coercion.
*   Prints BEFORE and AFTER row-count snapshots, with a per-table match indicator.

## Sitemap & Search Console Flow

How `/sitemap.xml` is generated, when it refreshes, and how that interacts with Google Search Console.

### Where the sitemap comes from

`app/sitemap.ts` is a Next.js metadata route that serves `/sitemap.xml`. When it runs it queries the live database and emits one flat XML file with four kinds of entries:

*   **Homepage** — `/` (priority 1.0, daily).
*   **Cities** — `storage.getCities(true)` filtered to `allowIndexing !== false` → `/locations/{slug}` (priority 0.8, weekly, `lastModified = city.updatedAt`).
*   **Pages** — `storage.getPages()` filtered to `isPublished === true` → `/{slug}` (priority 0.7, weekly, `lastModified = page.updatedAt`).
*   **Knowledge articles** — `storage.getKnowledgeArticles("published")` minus any with `noindex` in `robots` → `/discovery/knowledge/{slug}` (priority 0.7, weekly, `lastModified = article.dateModified`).

The base URL is `process.env.NEXT_PUBLIC_BASE_URL` (resolves to `https://www.tableicity.com` in US prod). `app/robots.ts` advertises the sitemap location to crawlers via `Sitemap: {BASE_URL}/sitemap.xml`.

### When the sitemap actually refreshes

There are two content-publish paths and they behave differently:

**Path A — Publish via deploy.** Generate content in admin, then click Publish. The deploy rebuilds the app; during build the sitemap function runs against prod DB and the resulting XML is baked into the new deployment. Net result: every Publish guarantees a fresh sitemap.

**Path B — Newsroom scheduler creates content automatically (no deploy).** The cron-driven scheduler writes a new `published` article straight into prod DB. No rebuild fires. Whether `/sitemap.xml` immediately reflects the new article depends on whether Next.js is serving the static build-time copy or regenerating it per request — to be safe, treat the sitemap as eventually-consistent until the next deploy.

### Recommended workflow after publishing content

1.  Generate the article (admin or scheduler) — it lands in prod DB.
2.  Click **Publish** to deploy. This forces a fresh `/sitemap.xml` baked from the latest DB state.
3.  Open `https://www.tableicity.com/sitemap.xml` and search for the new article slug to confirm it's listed.
4.  In Google Search Console → **Sitemaps** → click the existing `sitemap.xml` entry → **Resubmit**. The URL never changes; resubmitting just nudges Google to recrawl sooner. (Even without resubmitting, GSC re-fetches submitted sitemaps every day or two.)

### Things worth knowing

*   **No 50,000-URL split needed yet.** The function returns one flat array. Current scale (~25 cities + handful of pages + ~20 articles) is well under Google's 50k-URL / 50 MB sitemap limits. If we cross either, we'll need to switch to a sitemap index file.
*   **`changeFrequency` and `priority` are largely ignored by Google today.** The signal that actually matters is `lastModified` — which is already wired to `updatedAt` / `dateModified`, so edits propagate correctly.
*   **Drafts and `noindex` content are excluded.** Articles with status other than `published`, cities with `allowIndexing: false`, and pages with `isPublished: false` never appear in the sitemap.
*   **Canonical URL hardcode caveat.** `lib/storage.ts` writes the canonical URL field on knowledge articles using a hardcoded `https://www.tableicity.com/discovery/knowledge/{slug}` string — see the EU handoff notes below. The sitemap entry uses `NEXT_PUBLIC_BASE_URL`, so on a regional fork the two would disagree until that file is updated.

## Remix / Regional Fork — EU Handoff Notes

The EU team is creating a separate Remix of this codebase that will run on EU-hosted infrastructure with its own databases, secrets, and domain. The US instance and EU instance share zero runtime resources.

The marketing/UX overview of the platform lives in `John/EU_Handover.md` (architecture, page flow, cookie banner, login redirects). This section is the **technical handoff complement** — the things that are hardcoded or US-specific in the source and would silently inherit into the EU clone if not changed.

### 1. Hardcoded `tableicity.com` URLs to update for the EU domain

The codebase falls back to `https://www.tableicity.com` whenever `NEXT_PUBLIC_BASE_URL` is unset, but a few places hardcode it directly:

*   `middleware.ts` — apex → www redirect target.
*   `lib/storage.ts` — canonical URL written into `knowledge_articles.canonicalUrl` on create/update (overrides whatever `NEXT_PUBLIC_BASE_URL` is set to).
*   `lib/newsroom/cityResearchAutoSeeder.ts` — User-Agent string sent to source sites.
*   `scripts/newsroom-cron-tick.mjs` — fallback cron base URL.
*   `config/localVibePrompts.ts` — example URL inside an LLM prompt.

`NEXT_PUBLIC_BASE_URL` itself is read by ~12 routes/pages (sitemap, robots, JSON-LD, OpenGraph, draft URLs). Setting it correctly in the EU repl handles those automatically; the five files above must be edited by hand.

### 2. Hardcoded brand string `"Tableicity"`

Will appear in copy, JSON-LD, defaults, and prompts unless renamed:

*   `shared/schema.ts` — `knowledge_articles.authorName` and `publisherName` default to `"Tableicity"`.
*   `lib/newsroom/pairProcessor.ts` — hardcodes `authorName: "Tableicity"`, `publisherName: "Tableicity"`, and the meta-description fallback `"… Tableicity insights for founders in {city}, {state}."`
*   `config/localVibePrompts.ts` — the system prompt opens with **"You are writing a Tableicity press-release-style knowledge article for US founders and finance operators."** Change brand AND `for US founders` for an EU brief.
*   `components/homepage/login-panel.tsx`, `marketing-panel.tsx`, `city-marketing-panel.tsx` — visible brand text and slideshow alt text (10+ strings).

### 3. Required environment secrets for the EU repl

Every secret is per-instance — never share US ↔ EU. Recreate all of these in the EU repl's secrets:

| Secret | Used by | Notes for EU |
|---|---|---|
| `DATABASE_URL` | dev DB connection | Provision an EU-region Postgres (Neon EU, Supabase EU, etc.) for data residency. |
| `PROD_DATABASE_URL` | `scripts/sync-dev-to-prod.ts`, `scripts/push-schema-to-prod.sh` | EU prod DB. The sync script refuses to run if dev/prod resolve to the same host+db, which also prevents accidental cross-region writes. |
| `SESSION_SECRET` | JWT signing in `lib/auth.ts` and `server/routes.ts` | Generate a fresh random string; do not reuse the US value. |
| `NEXT_PUBLIC_BASE_URL` | sitemap, robots, JSON-LD, canonical URLs | Set to the EU public domain (e.g. `https://www.tableicity.eu`). |
| `OPENAI_API_KEY` | Newsroom 5-agent pipeline + auditor | Confirm the OpenAI org has an EU data-residency agreement. |
| `OPENCAGE_API_KEY` | `lib/geocoding.ts` for city lat/long | Works globally; just create a separate key for usage tracking. |
| `CRON_SECRET` | `app/api/cron/newsroom-scheduler` and `scripts/newsroom-cron-tick.mjs` | Per-instance random string. |
| `NEWSROOM_WORKER_SECRET` | `lib/newsroom.ts` worker auth | Per-instance random string. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_DISPLAY` / `ADMIN_PURGE_OTHERS` | `scripts/upsert-super-admin.ts` for first admin seed | EU team picks their own; password ≥ 12 chars. |

`.env.example` only lists the four most-basic vars (`DATABASE_URL`, `SESSION_SECRET`, `NEXT_PUBLIC_BASE_URL`, `PORT`) and is out of date — the table above is authoritative.

### 4. US-centric schema fields

`city_locations` (in `shared/schema.ts`) was modeled around US states:

*   `state_code varchar(2) NOT NULL` — fits US 2-letter state codes; also fits ISO 3166-1 alpha-2 country codes if the EU team wants to repurpose it for country, but the field name will be misleading. Cleaner option: add `country_code` and make `state_code` nullable, or rename via a migration.
*   `state_name varchar(50)` — fine for any region.
*   Slug builder in `server/routes.ts` and `client/src/pages/admin-cities.tsx` is `${cityName}-${stateCode.toLowerCase()}`. EU example: `paris-fr` works, but the EU team should decide if they want country-only suffix, region (NUTS), or postal-prefix slugs.

### 5. US-centric Newsroom auto-seeder (`lib/newsroom/cityResearchAutoSeeder.ts`)

Before each Pair run the auto-seeder probes US-shaped URLs for grounding:

*   Wikipedia: `en.wikipedia.org/wiki/{City},_{StateName}` (English-only).
*   Municipal: `{cityFlat}.gov`, `cityof{cityFlat}.org`, `cityof{cityFlat}.com`.
*   Chamber: `{cityFlat}chamber.com`, `{cityFlat}chamberofcommerce.com`.
*   Crunchbase: `crunchbase.com/hub/{state}-{city}-startups`.

For EU cities these will mostly 404 — meaning every EU city will fail the **Scheduler Picker Grounding Gate** (`lib/newsroom/schedulerPicker.ts`) and the auto-scheduler will skip them. The EU team should either:

*   Replace the URL families with EU-appropriate sources (Wikipedia in local language, Eurostat city profiles, EU chamber of commerce networks, official municipal `.gouv.fr` / `.gov.uk` / `.gv.at` patterns, etc.), **or**
*   Manually seed `city_research_sources` for each EU city via `POST /api/admin/cities/[id]/research-sources` and rely on manual `/admin/newsroom/pair` runs.

### 6. GDPR & data residency

The US instance has minimal user-facing PII (admin login only), but the EU instance will be subject to GDPR end-to-end. Items to verify before opening to EU traffic:

*   **Cookie consent**: `John/EU_Handover.md` notes the existing cookie card is a US-style gateway. EU needs granular categories (necessary / analytics / marketing) with reject-all defaulting to no non-essential cookies. The auth cookie itself (httpOnly JWT) is strictly necessary and exempt.
*   **Database hosting region** — pick an EU region in Neon/Supabase. The sync script does not enforce this; it's a hosting choice.
*   **OpenAI**: confirm Zero Data Retention or EU residency on the OpenAI account used for the Newsroom pipeline. Article body content goes to OpenAI on every Pair run.
*   **OpenCage**: lat/long geocoding sends city/address strings to OpenCage. They are ICO-registered and GDPR-compliant.
*   **Admin audit log** (`admin_audit_log`): records actor email, IP, and action — already a controller-of-record dataset; add to your Article 30 register.
*   **Right-to-erasure**: there is no public-user account system, so erasure scope is limited to admin users (`DELETE /api/admin/users/[id]`) and any inbound email/contact form submissions you may add later.

### 7. Pre-publish sync — per-instance

The sync workflow described earlier in this document is **per-instance**. The EU repl will have its own `DATABASE_URL` (EU dev) and `PROD_DATABASE_URL` (EU prod), and `scripts/sync-dev-to-prod.ts` runs Dev→Prod within that one EU instance. The script's safety check (refuses to run if both resolve to the same host+db) also makes it impossible to accidentally point the US dev at the EU prod or vice versa, but only because they will naturally be different hosts — there is no explicit US/EU tagging in the script.

### 8. Suggested smoke tests after the EU clone is wired up

Run these in order before announcing the EU site:

1.  `npm run dev` — confirm the app boots and `GET /` returns 200.
2.  Visit `/locations` — should load (empty grid is fine).
3.  Seed at least one EU city via the admin UI or `POST /api/admin/cities`; confirm OpenCage geocoding fills lat/long.
4.  Visit `/locations/[your-eu-slug]` — verify the page renders and the Google Map embeds for the EU coordinates.
5.  `npx tsx scripts/upsert-super-admin.ts` (with EU env vars) — confirm admin login works at `/admin`.
6.  Open `/sitemap.xml` and `/robots.txt` — confirm they emit the EU `NEXT_PUBLIC_BASE_URL`, not `tableicity.com`.
7.  Search the rendered HTML of `/` and `/locations/[slug]` for the literal string `tableicity.com` — should be zero matches once the five hardcoded files in §1 are updated.
8.  Run a manual Newsroom Pair against an EU city via `/admin/newsroom/pair` — confirm the pipeline completes (or fails cleanly) and check the resulting article's `canonicalUrl` points at the EU domain.
9.  `npx tsx scripts/sync-dev-to-prod.ts` (dry run) — confirm it correctly identifies EU dev and EU prod as separate hosts and the table list looks right.
10. Verify the cookie consent card shows EU-style granular categories before any tracker fires.

## External Dependencies

*   **PostgreSQL**: Primary database.
*   **OpenCage API**: Geocoding services for city latitude/longitude.
*   **OpenAI API**: Used for the Newsroom content generation pipeline, specifically leveraging the `gpt-4.1-nano` model for live content generation and `gpt-4o-mini` for the dry-run path.