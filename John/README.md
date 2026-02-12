# City Landing Page Manager

A production-ready, full-stack platform for managing location-based landing pages across 150+ US cities. Built for sales and marketing teams who need programmatic SEO at scale — create hundreds of city-specific pages from reusable content templates with automatic placeholder substitution.

---

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Platform Capabilities](#platform-capabilities)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Development](#development)
- [Production Deployment](#production-deployment)
- [Admin Dashboard](#admin-dashboard)
- [Page Builder](#page-builder)
- [SEO Features](#seo-features)
- [Security](#security)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

This platform solves a common challenge for multi-location businesses: creating and maintaining unique, SEO-optimized landing pages for every city you serve. Instead of manually building 150+ pages, you define content templates with placeholders like `{{city}}` and `{{state_name}}`, then assign them to cities. The system automatically generates unique pages with localized content, structured data, and proper SEO metadata.

Beyond city pages, the built-in **Page Builder** lets you create custom marketing pages (Homepage, Pricing, About, etc.) using a flexible slide-based content management system with 7 content block types.

### Key Value Propositions

- **Programmatic SEO** — Generate hundreds of unique, indexable city pages from reusable templates
- **Zero Vendor Lock-In** — Standard Next.js application deployable anywhere (AWS, Vercel, Docker, etc.)
- **Admin Dashboard** — Full CRUD management for cities, templates, and custom pages
- **Page Builder** — Slide-based content editor for custom marketing pages
- **Production Security** — JWT auth, rate limiting, input sanitization, audit logging, XSS prevention

---

## Technology Stack

### Frontend
| Technology | Purpose |
|---|---|
| **Next.js 16** | App Router with SSR, static generation, and API routes |
| **React 18** | UI component library with TypeScript |
| **Tailwind CSS 3** | Utility-first styling with CSS variable theming |
| **shadcn/ui** | Pre-built accessible components (Radix UI primitives) |
| **TanStack React Query v5** | Server state management and caching for admin pages |
| **Lucide React** | Icon library |
| **next-themes** | Dark/light mode support |

### Backend
| Technology | Purpose |
|---|---|
| **Next.js API Routes** | RESTful API endpoints with App Router |
| **PostgreSQL** | Primary database (Neon-compatible) |
| **Drizzle ORM** | Type-safe database queries with automatic migrations |
| **drizzle-zod** | Schema validation bridging Drizzle and Zod |
| **jose** | JWT token creation and verification |
| **scrypt** | Password hashing (Node.js built-in crypto) |

### DevOps & Tooling
| Technology | Purpose |
|---|---|
| **TypeScript** | End-to-end type safety |
| **Zod** | Runtime schema validation for API inputs |
| **AWS App Runner** | Production deployment target (standalone output) |
| **GitHub** | Version control and CI/CD integration |

---

## Platform Capabilities

### 1. City Location Management
- Add, edit, and delete city locations with full address and coordinate data
- Bulk CSV import for rapid city onboarding (upload hundreds of cities at once)
- Bulk publish/unpublish operations for managing city visibility
- Per-city fields: name, state, slug, address, latitude/longitude, landmarks, nearby cities, Google Maps embed URL
- Automatic slug generation for clean URLs (`/locations/austin-tx`)

### 2. Content Template System
- Create reusable HTML content templates with placeholder variables
- Supported placeholders: `{{city}}`, `{{state_name}}`, `{{state_code}}`, `{{address}}`, `{{landmarks}}`, `{{nearby_cities}}`
- Assign templates to multiple cities with one click
- Bulk template assignment across selected cities
- Templates render as full HTML with automatic placeholder substitution

### 3. Page Builder (Custom Marketing Pages)
- Create unlimited custom pages (Homepage, Pricing, About, Contact, etc.)
- 7 slide types for flexible page composition:
  - **Hero** — Full-width hero sections with headline, subheadline, CTA button, and background image
  - **Features** — 3 or 4 column feature grids with icons, titles, and descriptions
  - **Pricing** — Pricing tier cards with feature lists and CTA buttons
  - **Text** — Rich text content blocks with headings and body copy
  - **Image + Text** — Side-by-side image and text layouts (left/right alignment)
  - **CTA** — Call-to-action sections with headline, description, and button
  - **Custom HTML** — Raw HTML blocks with server-side XSS sanitization
- Slide reordering (move up/down)
- Per-page SEO metadata (meta title, meta description, OG image)
- Publish/unpublish workflow
- Preview in new tab
- Homepage integration — assign a page with slug `home` to replace the default homepage

### 4. Admin Dashboard
- Login with JWT-based authentication
- Dashboard with real-time statistics (total cities, published cities, templates, pages)
- Full audit trail logging every admin action (create, update, delete, login)
- Responsive design for desktop and tablet management

### 5. SEO Engine
- Server-side rendered public pages (SSR with `generateMetadata`)
- `generateStaticParams` for build-time static generation of city pages
- Canonical URLs on every page
- OpenGraph meta tags for social media sharing
- JSON-LD structured data (LocalBusiness schema) on city pages
- Dynamic `sitemap.xml` including all cities and custom pages
- Dynamic `robots.txt`
- Clean URL structure (`/locations/city-slug`, `/page-slug`)

---

## Project Structure

```
.
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Public homepage (SSR)
│   ├── city-grid.tsx             # City search/filter grid
│   ├── layout.tsx                # Root layout
│   ├── sitemap.ts                # Dynamic sitemap.xml
│   ├── robots.ts                 # Dynamic robots.txt
│   ├── locations/
│   │   └── [slug]/page.tsx       # City landing pages (SSR + static params)
│   ├── [slug]/page.tsx           # Custom page routes (Page Builder)
│   ├── admin/
│   │   ├── login/page.tsx        # Admin login
│   │   ├── page.tsx              # Admin dashboard
│   │   ├── layout.tsx            # Admin layout with sidebar
│   │   ├── cities/page.tsx       # City management
│   │   ├── templates/page.tsx    # Template management
│   │   └── pages/
│   │       ├── page.tsx          # Page Builder list
│   │       └── [id]/edit/page.tsx # Page Builder editor
│   └── api/                      # API routes
│       ├── admin/                # Protected admin endpoints
│       ├── locations/            # Public location endpoints
│       └── seed/                 # Database seeding
├── components/
│   ├── slides/                   # 7 slide renderer components
│   └── ui/                       # shadcn/ui components
├── lib/
│   ├── storage.ts                # Database storage layer (IStorage interface)
│   ├── db.ts                     # Drizzle database connection
│   ├── auth.ts                   # JWT authentication helpers
│   ├── audit.ts                  # Audit logging
│   ├── rate-limit.ts             # Login rate limiting
│   ├── sanitize.ts               # XSS input sanitization
│   ├── seed.ts                   # Database seeding logic
│   ├── placeholder-replacer.ts   # Template variable substitution
│   └── queryClient.ts            # React Query client
├── shared/
│   └── schema.ts                 # Drizzle schema + Zod validation
├── next.config.mjs               # Next.js config (standalone output)
├── tailwind.config.ts            # Tailwind configuration
├── drizzle.config.ts             # Drizzle ORM config
└── package.json
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (recommended: 20 LTS)
- **PostgreSQL** 14+ (local instance, Neon, Supabase, or any provider)
- **npm** or **yarn**

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/city-landing-page-manager.git
cd city-landing-page-manager

# Install dependencies
npm install

# Set up environment variables (see section below)
cp .env.example .env

# Push database schema
npm run db:push

# Seed the database with sample data
# After starting the dev server, POST to /api/seed

# Start development server
npm run dev
```

The application will be available at `http://localhost:5000`.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (e.g., `postgresql://user:pass@host:5432/dbname`) |
| `SESSION_SECRET` | Yes | Secret key for JWT token signing (use a long random string) |
| `NEXT_PUBLIC_BASE_URL` | No | Base URL for canonical tags and OG metadata (defaults to `https://yourcompany.com`) |

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/city_pages
SESSION_SECRET=your-secret-key-here-make-it-long-and-random
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

---

## Database Setup

The application uses **Drizzle ORM** for type-safe database management.

### Schema Overview (7 Tables)

1. **admin_users** — Admin accounts with hashed passwords
2. **city_locations** — City data (name, state, coordinates, landmarks, etc.)
3. **content_templates** — Reusable HTML content templates with placeholders
4. **city_content_assignments** — Links cities to their assigned templates
5. **admin_audit_log** — Complete audit trail of all admin actions
6. **custom_pages** — Page Builder pages with SEO metadata
7. **page_slides** — Content blocks (slides) for custom pages

### Commands

```bash
# Push schema changes to the database
npm run db:push

# Seed initial data (cities, templates, admin user)
# Start the server first, then:
curl -X POST http://localhost:5000/api/seed
```

### Default Admin Credentials

- **Username:** `admin`
- **Password:** `admin123`

> **Important:** Change the default password immediately after first login in a production environment.

---

## Development

```bash
# Start the development server (port 5000)
npm run dev

# The server includes:
# - Hot module replacement for frontend changes
# - API route hot reload
# - Automatic TypeScript compilation
```

### Key Development Notes

- All API routes are under `app/api/` using Next.js App Router conventions
- The storage layer (`lib/storage.ts`) implements the `IStorage` interface — all database operations go through this abstraction
- Zod schemas in `shared/schema.ts` validate all API inputs
- Admin routes require a valid JWT cookie (set via `/api/admin/login`)

---

## Production Deployment

### AWS App Runner (Recommended)

The application is configured for AWS App Runner with standalone output:

```bash
# Build for production
next build

# The standalone output is in .next/standalone/
# It includes a minimal Node.js server
node .next/standalone/server.js
```

**next.config.mjs** is already set with `output: 'standalone'` for optimized container deployments.

### Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

ENV PORT=5000
EXPOSE 5000
CMD ["node", "server.js"]
```

### Other Platforms

The app is a standard Next.js application and can deploy to:
- **Vercel** — Zero-config deployment
- **Railway** — Connect GitHub repo for auto-deploy
- **Fly.io** — Container-based deployment
- **Any Node.js host** — Use the standalone build output

---

## Admin Dashboard

Access the admin panel at `/admin/login`.

### Dashboard (`/admin`)
- Overview statistics: total cities, published cities, templates, custom pages
- Quick navigation to management sections

### City Management (`/admin/cities`)
- Add individual cities with full location data
- Bulk CSV import (columns: name, state_code, state_name, address, lat, lng)
- Bulk publish/unpublish selected cities
- Bulk template assignment
- Edit city details inline
- Delete cities with confirmation

### Template Management (`/admin/templates`)
- Create content templates with HTML and placeholder variables
- Available placeholders: `{{city}}`, `{{state_name}}`, `{{state_code}}`, `{{address}}`, `{{landmarks}}`, `{{nearby_cities}}`
- Preview rendered output
- Assign templates to cities

### Page Builder (`/admin/pages`)
- Create custom marketing pages
- Manage slides (content blocks) with JSON editor
- 7 slide types: Hero, Features, Pricing, Text, Image+Text, CTA, Custom HTML
- Reorder slides with up/down controls
- Publish/unpublish pages
- Configure SEO metadata per page

---

## Page Builder

The Page Builder enables creation of custom marketing pages using a slide-based architecture.

### Slide Types

| Type | Description | Key Fields |
|---|---|---|
| **Hero** | Full-width hero banner | headline, subheadline, ctaText, ctaUrl, backgroundImageUrl |
| **Features** | Feature grid (3-4 columns) | columns (3 or 4), features[] with icon, title, description |
| **Pricing** | Pricing tier cards | tiers[] with name, price, period, features[], ctaText, ctaUrl, highlighted |
| **Text** | Rich text content | heading, body (HTML supported) |
| **Image + Text** | Side-by-side layout | heading, body, imageUrl, imageAlt, imagePosition (left/right) |
| **CTA** | Call-to-action block | headline, description, ctaText, ctaUrl |
| **Custom HTML** | Raw HTML (sanitized) | html (scripts, iframes, event handlers stripped for security) |

### Homepage Integration

To use the Page Builder for your homepage:
1. Create a new page with the slug `home`
2. Add your desired slides
3. Publish the page

The homepage will automatically render the Page Builder content instead of the default city listing.

---

## SEO Features

### Per-City Pages
- Server-side rendered with `generateMetadata`
- Static params generation for build-time optimization
- JSON-LD `LocalBusiness` structured data
- OpenGraph tags with city-specific content
- Canonical URLs

### Custom Pages
- Configurable meta title and description per page
- OpenGraph image support
- Canonical URLs
- Included in dynamic sitemap

### Site-Wide
- Dynamic `sitemap.xml` at `/sitemap.xml` (cities + custom pages)
- Dynamic `robots.txt` at `/robots.txt`
- Clean URL structure for search engine crawling

---

## Security

| Feature | Implementation |
|---|---|
| **Authentication** | JWT tokens in httpOnly cookies (24h expiry) |
| **Password Hashing** | scrypt with random salt (Node.js crypto) |
| **Rate Limiting** | 5 login attempts per 15-minute window per IP |
| **XSS Prevention** | HTML entity encoding on all user inputs |
| **HTML Sanitization** | Custom HTML slides stripped of scripts, iframes, event handlers |
| **SQL Injection** | Drizzle ORM parameterized queries (no raw SQL) |
| **Audit Logging** | Every admin action logged with username, action, timestamp |
| **CSRF Protection** | SameSite cookie policy (lax) |

---

## Roadmap

### Near-Term Enhancements
- **Domain Connection** — Custom domain setup with SSL certificates
- **Rich Text Editor** — WYSIWYG editor for template and slide content (replace JSON editing)
- **Image Upload** — Built-in media library for hero images and slide assets
- **Analytics Integration** — Google Analytics / Plausible page view tracking per city
- **A/B Testing** — Template variant testing for conversion optimization

### Medium-Term Features
- **Multi-User Roles** — Editor, Admin, Super Admin permission levels
- **Content Scheduling** — Schedule page publish/unpublish dates
- **Localization** — Multi-language support for content templates
- **API Webhooks** — Notify external systems on content changes
- **Bulk Export** — Export city data and analytics as CSV/Excel

### Long-Term Vision
- **AI Content Generation** — Auto-generate city descriptions and template copy using LLMs
- **Dynamic Form Builder** — Lead capture forms embedded in city pages
- **CRM Integration** — Push leads from city pages directly to Salesforce, HubSpot, etc.
- **Multi-Tenant** — Support multiple brands/companies on a single platform instance
- **Performance Dashboard** — SEO ranking tracker, page speed monitoring, and conversion funnels

---

## License

This project is proprietary software. All rights reserved.

---

## Support

For questions, issues, or feature requests, please open an issue on the GitHub repository.
