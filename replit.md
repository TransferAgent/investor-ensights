# replit.md

## Overview

This is a **City Landing Page Manager** — a full-stack web application for managing location-based landing pages across multiple US cities. It provides a public-facing website where visitors can browse city locations and view templated content, plus an admin dashboard for managing cities, content templates, and template-to-city assignments. The core idea is programmatic SEO: create many city-specific pages from reusable content templates with placeholder substitution (e.g., `{{city}}`, `{{state_name}}`).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side router)
- **State/Data Fetching**: TanStack React Query for server state management
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Build Tool**: Vite with HMR in development
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Frontend Pages
- `/` — Public homepage listing all published cities
- `/locations/:slug` — Public city landing page with templated content
- `/admin/login` — Admin authentication page
- `/admin` — Admin dashboard with stats
- `/admin/cities` — City management (CRUD, bulk operations, publish/unpublish)
- `/admin/templates` — Content template management (CRUD)

### Backend
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript, executed via `tsx`
- **API Pattern**: REST API under `/api/` prefix
- **Session Management**: `express-session` with cookie-based sessions
- **Authentication**: Custom admin auth using scrypt password hashing (no passport), session-based with `requireAdmin` middleware
- **Development**: Vite dev server is integrated as Express middleware for HMR

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with `drizzle-zod` for schema validation
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Drizzle Kit with `db:push` command
- **Connection**: `pg` Pool via `DATABASE_URL` environment variable

### Database Tables
1. **city_locations** — City data (name, state, slug, address, coordinates, landmarks, nearby cities, publish status)
2. **content_templates** — Reusable content templates with placeholder patterns for meta tags, headers, body content, CTAs
3. **city_content_assignments** — Join table linking cities to templates
4. **admin_users** — Admin user accounts with hashed passwords

### Key Design Patterns
- **Shared Schema**: The `shared/` directory contains Drizzle schema and Zod validation schemas used by both client and server
- **Placeholder System**: Templates use `{{city}}`, `{{state}}`, `{{state_name}}`, `{{slug}}`, `{{address}}`, `{{landmarks}}`, `{{nearby_cities}}`, `{{phone}}`, `{{email}}` placeholders replaced at render time on the client
- **Storage Interface**: `IStorage` interface in `server/storage.ts` abstracts database operations via a `DatabaseStorage` class
- **Seed Data**: `server/seed.ts` contains seed data for 18 US cities and default templates

### Build Process
- **Development**: `npm run dev` runs tsx with Vite middleware
- **Production Build**: Custom `script/build.ts` uses Vite for client and esbuild for server, outputting to `dist/`
- **Server Build**: esbuild bundles server code as CJS, selectively bundling allowlisted dependencies for faster cold starts

## External Dependencies

### Required Services
- **PostgreSQL Database**: Required. Connection via `DATABASE_URL` environment variable. Uses Drizzle ORM for all database operations.

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required)
- `SESSION_SECRET` — Express session secret (defaults to `"dev-secret-change-me"` in dev)

### Key NPM Dependencies
- `express` v5 — HTTP server
- `drizzle-orm` + `drizzle-kit` — ORM and migration tooling
- `pg` — PostgreSQL client
- `express-session` — Session management
- `zod` + `drizzle-zod` — Schema validation
- `@tanstack/react-query` — Client-side data fetching
- `wouter` — Client-side routing
- `shadcn/ui` components (Radix UI + Tailwind)
- `lucide-react` — Icon library