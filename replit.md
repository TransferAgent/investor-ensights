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
- `app/page.tsx` — Public homepage (SSR Server Component), lists published cities
- `app/city-grid.tsx` — Client component for search/filter city grid
- `app/locations/[slug]/page.tsx` — City landing page (SSR with generateStaticParams + generateMetadata)
- `app/admin/login/page.tsx` — Admin login (Client Component)
- `app/admin/page.tsx` — Admin dashboard with stats (Client Component)
- `app/admin/cities/page.tsx` — City management CRUD + bulk ops (Client Component)
- `app/admin/templates/page.tsx` — Template management CRUD (Client Component)
- `app/sitemap.ts` — Dynamic sitemap
- `app/robots.ts` — Dynamic robots.txt

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

### Key Files
- `lib/storage.ts` — DatabaseStorage class implementing IStorage interface
- `lib/db.ts` — Drizzle database connection
- `lib/auth.ts` — JWT auth helpers
- `lib/seed.ts` — Database seeding (cities + templates + admin user)
- `lib/placeholder-replacer.ts` — Template placeholder substitution
- `lib/queryClient.ts` — React Query client + apiRequest helper
- `components/theme-provider.tsx` — next-themes wrapper
- `components/query-provider.tsx` — React Query provider wrapper
- `components/ui/` — shadcn/ui components

### Build & Run
- **Development**: `npm run dev` → launches Next.js dev server on port 5000
- **Production**: `next build` (standalone output for AWS App Runner)
- **Database**: `npm run db:push` syncs Drizzle schema

### SEO Features
- Server-side rendered public pages with generateMetadata
- Canonical URLs on every page (via NEXT_PUBLIC_BASE_URL env var)
- OpenGraph tags on city pages
- JSON-LD structured data on city pages
- Dynamic sitemap.xml and robots.txt
- generateStaticParams for city pages

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required)
- `SESSION_SECRET` — JWT signing secret
- `NEXT_PUBLIC_BASE_URL` — Base URL for canonical/OG tags (defaults to https://yourcompany.com)
