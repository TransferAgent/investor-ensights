# replit.md

## Overview

This is a **City Landing Page Manager** — a full-stack web application for managing location-based landing pages across multiple US cities. It provides a public-facing website where visitors can browse city locations and view templated content, plus an admin dashboard for managing cities, content templates, and template-to-city assignments. The core idea is programmatic SEO: create many city-specific pages from reusable content templates with placeholder substitution (e.g., `{{city}}`, `{{state_name}}`).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Framework
- **Next.js 16** with App Router (migrated from Express + React SPA)
- **React 18** with TypeScript
- **Tailwind CSS 3** with CSS variables for theming
- **shadcn/ui** components (Radix UI primitives)
- **TanStack React Query** for admin page data fetching
- **Path Aliases**: `@/` maps to project root, `@shared/` maps to `shared/`

### Pages (App Router)
- `app/page.tsx` — Public homepage (SSR), two-panel Tableicity marketing + login layout (or Page Builder if "home" page published)
- `app/locations/page.tsx` — Locations grid page (SSR), hero banner + city grid with search/filter/geo-detection
- `app/city-grid.tsx` — Client component for search/filter city grid with IP-based state detection
- `app/locations/[slug]/page.tsx` — City landing page (SSR), two-panel layout clone: left=city-specific marketing content (H1/H2/body from templates, slideshow, contact info, landmarks, map), right=login panel with hover redirect to Cap Table App
- `app/[slug]/page.tsx` — Custom page (SSR, Page Builder pages with generateMetadata + generateStaticParams)
- `app/admin/login/page.tsx` — Admin login (Client Component)
- `app/admin/page.tsx` — Admin dashboard with stats (Client Component)
- `app/admin/cities/page.tsx` — City management CRUD + bulk ops (Client Component)
- `app/admin/templates/page.tsx` — Template management CRUD (Client Component)
- `app/admin/pages/page.tsx` — Page Builder list view (Client Component)
- `app/admin/pages/[id]/edit/page.tsx` — Page Builder editor with slide management (Client Component)
- `app/admin/knowledge/page.tsx` — Knowledge/Press Release management (Client Component) — create, edit, publish, archive, version history
- `app/discovery/knowledge/[slug]/page.tsx` — Public press release page (SSR) with full SEO (title, description, canonical, robots, JSON-LD NewsArticle)
- `app/sitemap.ts` — Dynamic sitemap (includes cities + custom pages + published knowledge articles)
- `app/robots.ts` — Dynamic robots.txt

### Middleware
- `middleware.ts` — 301 redirect non-www → www (`tableicity.com` → `www.tableicity.com`)

### API Routes (App Router)
All under `app/api/`:
- `admin/login/route.ts` — POST login with JWT
- `admin/logout/route.ts` — POST logout
- `admin/me/route.ts` — GET current user
- `admin/cities/route.ts` — GET/POST cities
- `admin/cities/[id]/route.ts` — PATCH/DELETE city
- `admin/cities/bulk-csv/route.ts` — POST CSV bulk import
- `admin/bulk-update/route.ts` — POST publish/unpublish/assign template
- `admin/templates/route.ts` — GET/POST templates
- `admin/templates/[id]/route.ts` — PATCH template
- `admin/pages/route.ts` — GET/POST custom pages
- `admin/pages/[id]/route.ts` — GET/PATCH/DELETE custom page
- `admin/pages/[id]/slides/route.ts` — GET/POST slides for a page
- `admin/pages/[id]/slides/[slideId]/route.ts` — PATCH/DELETE slide
- `admin/pages/[id]/slides/reorder/route.ts` — POST reorder slides
- `admin/knowledge/route.ts` — GET/POST knowledge articles
- `admin/knowledge/[id]/route.ts` — GET/PATCH/DELETE knowledge article
- `admin/knowledge/[id]/publish/route.ts` — POST publish article (creates version snapshot, validates OG image reachability + 1200px+ width, stores image dimensions)
- `admin/knowledge/[id]/archive/route.ts` — POST archive article (creates version snapshot)
- `admin/knowledge/[id]/unarchive/route.ts` — POST restore archived article to pending (creates version snapshot)
- `admin/knowledge/[id]/versions/route.ts` — GET version history
- `admin/knowledge-templates/route.ts` — GET/POST knowledge templates
- `admin/knowledge-templates/[id]/route.ts` — GET/PATCH/DELETE knowledge template
- `admin/knowledge-templates/generate/route.ts` — POST generate articles from template for all published cities
- `admin/knowledge/metrics/route.ts` — GET publish cadence metrics (today, thisWeek, avgPerDay, pendingCount)
- `admin/knowledge/analytics/route.ts` — GET analytics (publishedThisMonth, discoverEligible, avgFreshnessScore, pendingCount)
- `admin/knowledge/coverage/route.ts` — GET city coverage tracker (matches articles to cities via city_slug field)
- `admin/knowledge/generation-log/route.ts` — GET generation log entries with daily count
- `knowledge/draft/route.ts` — POST structured draft ingestion (G5 contract v1: pending-only, validated, audited, rate-limited, content quality guards)
- `knowledge/generate-local-vibe/route.ts` — POST generate Local Vibe draft for a city (G6/G7: versioned prompt template, generation logging)
- `knowledge/bulk-generate/route.ts` — POST bulk generate Local Vibes (max 50 cities, concurrency 3, 30-day duplicate skip)
- `admin/data-store/route.ts` — GET/POST data store files (upload via multipart form)
- `admin/data-store/[id]/route.ts` — PATCH/DELETE data store file
- `admin/data-store/[id]/download/route.ts` — GET download file
- `admin/stats/route.ts` — GET dashboard stats
- `locations/route.ts` — GET public published cities
- `locations/[slug]/route.ts` — GET public city detail
- `seed/route.ts` — POST database seed

### Authentication
- JWT-based with `jose` library
- Tokens stored in httpOnly cookies
- Helpers: `lib/auth.ts` (createSession, verifySession, destroySession)
- Default admin: username `admin`, password `admin123`

### Data Storage
- **Database**: PostgreSQL via `DATABASE_URL`
- **ORM**: Drizzle ORM with `drizzle-zod` for validation
- **Schema**: `shared/schema.ts`

### Database Tables
1. **city_locations** — City data (name, state, slug, address, coordinates, landmarks, nearby cities, publish status)
2. **content_templates** — Reusable content templates with placeholder patterns
3. **city_content_assignments** — Join table linking cities to templates
4. **admin_users** — Admin accounts with scrypt-hashed passwords
5. **admin_audit_log** — Tracks all admin actions (login, create, update, delete) with username, action, entity type/id, and timestamp
6. **custom_pages** — Page Builder pages with slug, title, SEO metadata, publish status
7. **page_slides** — Individual content blocks (slides) for custom pages with JSON content, type, order, and styling options
8. **knowledge_articles** — Press releases/articles with tri-state status (pending/published/archived), SEO fields, body HTML, author/publisher, JSON-LD support
9. **knowledge_article_versions** — Append-only immutable archive trail capturing full article snapshots on publish/archive actions
10. **knowledge_generation_log** — Audit trail for every generation call (city_slug, directive, status, error_message, timestamp)
12. **data_store_files** — File uploads (Word, PDF, TXT, HTML, Markdown) with base64 storage, tri-state status (pending/approved/rejected), notes, audit trail
11. **knowledge_templates** — Reusable press release templates with placeholder patterns ({{city}}, {{state_name}}, etc.) for bulk article generation

### Security Features
- **Password hashing**: scrypt with random salt (Node.js built-in)
- **JWT cookies**: httpOnly, secure (in production), sameSite: lax, 24h expiry
- **Rate limiting**: Login attempts limited to 5 per 15-minute window per IP (`lib/rate-limit.ts`)
- **Input sanitization**: XSS prevention via HTML entity encoding (`lib/sanitize.ts`)
- **SQL injection protection**: Drizzle ORM uses parameterized queries
- **Audit logging**: All admin mutations logged to admin_audit_log table (`lib/audit.ts`)

### Key Files
- `lib/storage.ts` — DatabaseStorage class implementing IStorage interface
- `lib/db.ts` — Drizzle database connection
- `lib/auth.ts` — JWT auth helpers
- `lib/audit.ts` — Admin audit logging helper
- `lib/rate-limit.ts` — In-memory rate limiting for login
- `lib/sanitize.ts` — Input sanitization for XSS prevention
- `lib/geocoding.ts` — OpenCage geocoding (auto-fills lat/lng from address)
- `lib/seed.ts` — Database seeding (cities + templates + admin user)
- `lib/knowledge/payloadContract.ts` — Zod schema (KnowledgeDraftPayloadV1) for draft ingestion contract
- `config/localVibePrompts.ts` — Versioned prompt template library (v1+) for Local Vibe generation
- `lib/placeholder-replacer.ts` — Template placeholder substitution
- `lib/queryClient.ts` — React Query client + apiRequest helper
- `components/homepage/hero-home.tsx` — Two-panel homepage wrapper
- `components/homepage/marketing-panel.tsx` — Homepage left panel (slideshow, features, security)
- `components/homepage/city-marketing-panel.tsx` — City page left panel (H1/H2/body, slideshow, contact, landmarks, map)
- `components/homepage/login-panel.tsx` — Right panel with glass login card + hover redirect to Cap Table App
- `components/slides/slide-renderer.tsx` — Main slide renderer dispatcher
- `components/slides/` — 7 slide type components (hero, features, pricing, text, image_text, cta, html)
- `components/theme-provider.tsx` — next-themes wrapper
- `components/query-provider.tsx` — React Query provider wrapper
- `components/ui/` — shadcn/ui components

### Build & Run
- **Development**: `npm run dev` → launches Next.js dev server on port 5000
- **Production**: `next build` (standalone output for AWS App Runner)
- **Database**: `npm run db:push` syncs Drizzle schema

### SEO Features
- Server-side rendered public pages with generateMetadata
- Canonical URLs on every page (via NEXT_PUBLIC_BASE_URL env var, locked to https://www.tableicity.com)
- 301 redirect non-www → www via middleware.ts
- OpenGraph tags on city pages and knowledge articles
- JSON-LD NewsArticle structured data on knowledge articles (with image array, Organization author for brand, Organization publisher)
- JSON-LD structured data on city pages
- Robots "Beast" directive: `index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1`
- Dynamic sitemap.xml and robots.txt
- generateStaticParams for city pages

### Geocoding
- **OpenCage API** auto-fills latitude/longitude when saving cities without coordinates
- Triggers on: city create (POST), city update (PATCH), and bulk CSV import
- Falls back gracefully if API is unavailable — city still saves without coordinates
- Free tier: 2,500 requests/day (sufficient for 150+ cities)

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required)
- `SESSION_SECRET` — JWT signing secret
- `OPENCAGE_API_KEY` — OpenCage geocoding API key (for auto-filling lat/lng)
- `NEXT_PUBLIC_BASE_URL` — Base URL for canonical/OG tags (defaults to https://yourcompany.com, locked to https://www.tableicity.com)
