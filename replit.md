# replit.md

## Overview

This project is a **City Landing Page Manager**, a full-stack web application designed for programmatic SEO. It allows the creation and management of location-based landing pages across various US cities using reusable content templates with dynamic placeholder substitution. The application features a public-facing website for browsing city locations and templated content, alongside an admin dashboard for comprehensive management of cities, content templates, and their assignments.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application is built with **Next.js 16** (App Router), **React 18** (TypeScript), **Tailwind CSS 3** for styling, and **shadcn/ui** for UI components. Data fetching on the admin side is handled by **TanStack React Query**.

**Key Features:**

*   **Public-facing Pages:**
    *   Dynamic city landing pages (`/locations/[slug]`) generated from templates, featuring city-specific content, slideshows, contact info, and maps.
    *   A locations grid (`/locations`) with search, filter, and geo-detection capabilities.
    *   Custom pages (`/[slug]`) created via a Page Builder.
    *   Public press release/knowledge articles (`/discovery/knowledge/[slug]`) with full SEO support (JSON-LD, OpenGraph, dynamic sitemaps, robots.txt).
*   **Admin Dashboard:**
    *   Login and user authentication using JWT and httpOnly cookies.
    *   CRUD operations for cities, content templates, custom pages, and knowledge articles.
    *   Bulk operations for cities (CSV import, publish/unpublish, template assignment).
    *   A Page Builder for creating and managing custom pages with configurable content slides.
    *   A "Knowledge" section for managing press releases, including content studio for generation, template management, analytics, and coverage tracking.
    *   A Newsroom pipeline that has pivoted from "AI writer" to a **4-stage Pair → Glue → Audit → Schedule** press release pipeline. Haylo Lab authors production-ready unique HTML essays (one per city, ~300+ in library); Newsroom's only role is to (1) **Pair** a Haylo article with a destination city via the admin panel (city-first flow), (2) **Glue** = compose the press release (`lib/newsroom/pressReleaseComposer.ts` — appends `in {{city}}, {{state}}` to the Haylo title, builds dateline, injects a `<section class="newsroom-local-vibe">` block carrying the v3 grounded local vibe at the `<!-- newsroom:local-vibe -->` marker if Haylo provided one or after the first `</section>` as positional fallback, wraps in a press-release shell with byline/footer/Tableicity boilerplate), (3) **Audit** via `lib/newsroom/auditor.ts` (single gpt-4o-mini call, ~$0.0004/release, returns verdict pass/warn/fail + flowScore + categorized issues; checks city-mismatch, vibe-flow, contradictions, template-artifacts, tone — does NOT rewrite, only grades), (4) **Schedule** = drip-publish 5–10/day via Newsroom scheduler to avoid Google content-velocity flags. Publish gates: if local vibe is the sentinel `"insufficient commercial signal..."`, the composer **refuses to inject** and the auditor is skipped — that city's release does not publish until seed URLs are expanded. If Haylo library is empty for a city, Newsroom **stalls** rather than fall back to LLM generation (no door-hanger fallback). The Haylo body is treated as trusted production HTML and inserted into the wrapper with `allowHtmlInValues: true` to preserve Answer Block markup (schema.org, `<strong>` emphasis on key terms like SAFE/409A/ASC 718, `<h2>` hierarchy) — every other slot is HTML-escaped. Each placement = one `knowledge_articles` row keyed by city slug; admin Knowledge listing transitions from "1 Legacy press release × 300 cities" (door hangers) to "N rows = N (Haylo article × city) placements" with the same per-row tools as Legacy. The v3 fact-extraction pipeline still runs upstream (gpt-4o-mini, source-grounded — Researcher receives only fetched markdown from per-city seed URLs extracted via `@mozilla/readability` + `turndown`, every fact must cite a `sourceUrl`, QC stage deducts heavily for ungrounded facts; seed URLs managed per city via `/api/admin/cities/[id]/research-sources`). The v3 Analyst's `localVibe` is constrained to founder-relevant signals (investment $, named institutions, GDP, accelerators) and self-reports `"insufficient commercial signal in sources..."` rather than fabricating; `buildHayloPayload` surfaces this as a warning. The lower-level `hayloStitcher.ts` (pure search-and-replace, HTML-escapes values, tracks sourceUrl per replacement, never fabricates) is the primitive the composer is built on. The composer + auditor + scheduler are not yet wired into admin routes — they are demoed standalone against Manchester/Providence/Lowell with sample Haylo HTML, producing real press release HTML in `press-releases/` for review.
    *   Data store for managing file uploads.
*   **SEO Enhancements:** Server-Side Rendering (SSR), dynamic sitemap and robots.txt, canonical URLs, OpenGraph tags, and JSON-LD structured data are implemented across public pages.
*   **Authentication & Security:** JWT-based authentication with `scrypt` password hashing, httpOnly cookies, rate limiting for login attempts, input sanitization against XSS, SQL injection protection via Drizzle ORM, and comprehensive admin audit logging.
*   **Geocoding:** Integration with OpenCage API for automatic latitude/longitude population for cities.

**Data Storage:**
The application uses **PostgreSQL** as its database, accessed via **Drizzle ORM** and `drizzle-zod` for schema validation. Key database tables include `city_locations`, `content_templates`, `city_content_assignments`, `admin_users`, `admin_audit_log`, `custom_pages`, `page_slides`, `knowledge_articles`, `knowledge_article_versions`, `knowledge_generation_log`, `knowledge_campaigns`, `data_store_files`, `knowledge_templates`, `city_research_sources` (per-city seed URLs for the source-grounded Newsroom Researcher), and `haylo_articles` (the Haylo Library — production-ready essays from Haylo Lab keyed by sha256 `content_hash` unique index, with `placement_count` tracking how many cities have paired with each article).

**Haylo Library (admin):** `/admin/haylo` ("Haylo Library" sidebar entry between Pages and Knowledge) provides paste-in and file-drop ingestion for Haylo Lab essays. The paste form stores any HTML byte-for-byte (no sanitization — Haylo content is trusted). The "Scan Inbox" button reads `.html` files from the `haylo-inbox/` folder, parses an optional `<!-- topic: X -->` comment for the topic slug (falling back to filename), auto-detects title from `<h1>` → `<title>` → first `<p>` → filename, and ingests with `source="inbox-import"`. Duplicates are detected by sha256 of body HTML and skipped (also enforced by a unique DB index). Articles have status `ready`/`draft`/`retired`; only `ready` will be eligible for Pair-stage selection. Delete is blocked at the API and UI level whenever `placement_count > 0` to prevent removing an article that's already in published press releases. Preview uses a sandboxed `<iframe sandbox="" srcdoc>` so untrusted HTML cannot script the admin shell. All mutations write to `admin_audit_log`. API: `GET/POST /api/admin/haylo-articles`, `GET/PATCH/DELETE /api/admin/haylo-articles/[id]`, `POST /api/admin/haylo-articles/scan-inbox`. Storage primitives in `lib/haylo/ingest.ts` (`hashHaylo`, `parseHayloFile`, `buildInsertFromPaste`, `ensureUniqueSlug`).

## External Dependencies

*   **PostgreSQL**: Primary database for all application data.
*   **OpenCage API**: Used for geocoding services to auto-fill city latitude and longitude.
*   **OpenAI API**: Utilized for the Newsroom pipeline for AI-driven content generation, specifically with the `gpt-4o-mini` model.