# Tableicity EU Remix — Platform Handover Document

**Prepared by**: US Platform Team
**Date**: March 31, 2026
**Purpose**: Provide the EU Remix team with a granular understanding of the Tableicity marketing platform architecture, content systems, and workflows so the EU version can be adapted for the European market.

---

## 1. Platform Overview

Tableicity's marketing platform is **not** the product itself. It is a **landing page and content engine** that drives traffic to the actual application.

### The Core Flow

```
Visitor lands on www.tableicity.com
         │
         ▼
   Homepage (two-panel layout)
   ├── Left panel: Marketing slideshow + features
   └── Right panel: Login card
         │
         ▼
   Cookie Consent Card appears (mandatory gateway)
   ├── "Accept All" → redirects to https://app.tableicity.com/login
   └── "Reject All" → redirects to https://app.tableicity.com/login
```

**Key point**: The landing page platform serves ONLY as a redirect gateway to the actual Cap Table App. Every user action on the homepage ultimately redirects to `https://app.tableicity.com/login`. The login card's "Create one" link goes to `/register` and "Start a Free Trial" goes to `/launch` — all on the app domain, not the marketing site.

### For the EU Remix

- Your landing page will redirect to your EU app domain (e.g., `https://app.tableicity.eu/login`)
- The cookie consent card is already built — you will need to update it for GDPR compliance (the US version is a simple gateway; EU requires granular consent categories)
- Update `components/homepage/cookie-consent.tsx` — change `REDIRECT_URL` to your EU app domain
- Update `components/homepage/login-panel.tsx` — change the `href` values for register and launch links

---

## 2. The /locations System — Why It Matters

The `/locations` page is the **SEO engine** of the platform. It generates 150+ unique city-specific landing pages, each optimized for local search.

### Architecture

```
/locations                          → Grid of all published cities
/locations/[slug]                   → Individual city landing page (e.g., /locations/colorado-springs)
/locations/[slug]/press-releases    → Press releases for that specific city
```

### How City Pages Work

Each city landing page is a **two-panel layout** (same as homepage):
- **Left panel**: City-specific marketing content
  - H1 header (from content template, placeholders replaced)
  - H2 subheader (from content template)
  - Body content (from content template)
  - Photo slideshow
  - Contact info (address, phone, email)
  - Local landmarks
  - Google Maps embed
  - Press releases section (latest 2 articles for that city)
  - Nearby cities links
- **Right panel**: Login card (same as homepage — redirects to app)

### City Data Model

Each city record contains:
| Field | Purpose |
|-------|---------|
| `cityName` | Display name (e.g., "Colorado Springs") |
| `stateCode` | Two-letter state code (e.g., "CO") |
| `stateName` | Full state name (e.g., "Colorado") |
| `slug` | URL slug (e.g., "colorado-springs") |
| `streetAddress` | Physical address for Google Maps |
| `zipCode` | Postal code |
| `latitude/longitude` | Auto-filled by OpenCage geocoding API |
| `localLandmarks` | JSON array of local landmarks (used in templates) |
| `nearbyCities` | JSON array of nearby city names |
| `phoneNumber` | Local phone number |
| `email` | Contact email |
| `metaTitle` | SEO title tag |
| `metaDescription` | SEO meta description |
| `isPublished` | Controls visibility on public site |
| `allowIndexing` | Controls robots indexing |

### Content Templates (City Management)

Content templates use placeholder substitution to generate unique content per city:

| Placeholder | Replaced With |
|-------------|---------------|
| `{{city}}` | City name (e.g., "Colorado Springs") |
| `{{city_upper}}` | City name uppercase (e.g., "COLORADO SPRINGS") |
| `{{state_name}}` | Full state name (e.g., "Colorado") |
| `{{state_code}}` | State code (e.g., "CO") |
| `{{landmarks}}` | Comma-separated local landmarks |
| `{{nearby_cities}}` | Comma-separated nearby cities |

**Template fields**: H1 Header Pattern, H2 Subheader Pattern, Body Content Pattern, Meta Title Pattern, Meta Description Pattern

### For the EU Remix

- Replace US cities with EU cities (country, region/province instead of state)
- Adapt the data model: `stateCode` → country code or region code, `stateName` → country name or region
- Geocoding: OpenCage API works globally — no change needed
- You will need to create EU-specific content templates with localized placeholders
- Consider adding `{{country}}`, `{{region}}`, `{{country_code}}` placeholders
- Each published city gets a canonical URL, sitemap entry, and JSON-LD structured data

---

## 3. Admin Dashboard — /admin/login

**Default credentials**: username `admin`, password `admin123`
**Authentication**: JWT tokens stored in httpOnly cookies, 24-hour expiry

### Admin Sections

#### A. City Management (`/admin/cities`)

This is where you manage all city records:
- **Create/Edit cities**: Add city name, state, address, landmarks, nearby cities
- **Bulk CSV import**: Upload a CSV to create hundreds of cities at once
- **Publish/Unpublish**: Control which cities appear on the public site
- **Assign templates**: Link a content template to a city
- **Geocoding**: Latitude/longitude auto-filled from address via OpenCage API

**Content Templates** (accessible from City Management):
- Create reusable templates with H1, H2, Body, Meta Title, Meta Description patterns
- Assign a template to one or many cities
- Each city page renders the template with placeholders replaced by city-specific data

**Google Meta / SEO**:
- Every city page has `generateMetadata` for SSR SEO
- Canonical URLs: `https://www.tableicity.com/locations/{slug}`
- OpenGraph tags for social sharing
- JSON-LD structured data (LocalBusiness schema)
- Dynamic `sitemap.xml` includes all published cities
- Dynamic `robots.txt`

#### B. Knowledge / Press Releases (`/admin/knowledge`)

This is the **content publishing engine** with 5 tabs:

##### Tab 1: Articles
- Full CRUD for press releases
- Tri-state workflow: **Pending** → **Published** → **Archived**
- Each article has: Headline, Subheadline, Meta Title, Meta Description, Slug, Dateline, Body HTML, Boilerplate, Author, Publisher, OG Image
- Bulk operations: select multiple articles, pick a template, apply in place
- Campaign grouping for organizing articles
- Version history: every publish/archive creates an immutable snapshot

##### Tab 2: Content Studio
- **This is the power tool** — template + city picker workflow
- Select a Knowledge Template
- Select target cities (filter by state)
- Preview how the article will look for any city
- Generate articles in bulk (creates one article per city)
- "Update Existing" option for re-applying updated templates
- Auto-creates a campaign per generation run

##### Tab 3: Templates (Knowledge Templates)
- Create reusable press release templates
- Same placeholder system as city templates: `{{city}}`, `{{state_name}}`, etc.
- Fields: Template Name, Meta Title, Headline Pattern, Subheadline Pattern, Dateline Pattern, Body HTML Pattern, Boilerplate HTML, OG Image URL
- **Live Preview**: Pick any city and see the fully rendered article before generating
- HTML supported in Headline and Subheadline (tags auto-stripped on public page; page wraps headline in `<h1>`, subheadline in `<h2>` automatically)

##### Tab 4: Analytics
- Published this month count
- Discover-eligible articles
- Average freshness score
- Pending articles count

##### Tab 5: Coverage
- City coverage tracker — shows which cities have articles and which don't
- Helps identify gaps in your content strategy

### The Content Workflow

```
1. Create/Edit a Knowledge Template
   └── Define patterns with {{city}}, {{state_name}}, etc.

2. Go to Content Studio
   ├── Select the template
   ├── Select target cities (or filter by state)
   ├── Preview for any city
   └── Click "Generate" → creates articles for all selected cities

3. Review generated articles in Articles tab
   ├── Edit individual articles for city-specific customization
   ├── Add local backlinks, tweak headlines, etc.
   └── Publish when ready

4. Published articles appear:
   ├── On the public page: /discovery/knowledge/{slug}
   ├── On city landing pages: Press Releases section
   ├── In the sitemap.xml
   └── With full SEO (JSON-LD NewsArticle, OpenGraph, canonical URL)
```

---

## 4. Public-Facing Pages

| Route | Purpose |
|-------|---------|
| `/` | Homepage — marketing + login redirect |
| `/locations` | City grid with search/filter/geo-detection |
| `/locations/[slug]` | Individual city landing page |
| `/locations/[slug]/press-releases` | All press releases for a city |
| `/discovery/knowledge/[slug]` | Individual press release page |
| `/[slug]` | Custom pages (built via Page Builder) |
| `/sitemap.xml` | Dynamic sitemap |
| `/robots.txt` | Dynamic robots.txt |

---

## 5. Technical Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 (App Router, SSR) |
| Language | TypeScript |
| Database | PostgreSQL (Drizzle ORM) |
| Styling | Tailwind CSS 3 + shadcn/ui |
| Auth | JWT (jose library) + httpOnly cookies |
| Data fetching | TanStack React Query (admin pages) |
| Geocoding | OpenCage API |
| Port | 5000 (dev and production) |

---

## 6. Security Considerations

| Feature | Implementation |
|---------|----------------|
| Password hashing | scrypt with random salt |
| JWT cookies | httpOnly, secure (production), sameSite: lax, 24h expiry |
| Rate limiting | 5 login attempts per 15-minute window per IP |
| Input sanitization | HTML entity encoding (XSS prevention) |
| SQL injection | Drizzle ORM parameterized queries |
| Audit logging | All admin actions logged with username, action, entity, timestamp |
| NODE_ENV | Must be set to "production" in deployment entry point for secure cookies |

### Critical Production Fix (Applied)

The production entry point (`dist/index.cjs`) must set `process.env.NODE_ENV = "production"`. Without this, auth cookies do not get the `secure` flag, allowing session tokens to be transmitted over unencrypted connections. **Verify this is set in your EU Remix build script (`script/build.ts`).**

---

## 7. EU Adaptation Checklist

### Must Change
- [ ] `REDIRECT_URL` in `cookie-consent.tsx` → EU app domain
- [ ] Login panel links in `login-panel.tsx` → EU app domain
- [ ] `NEXT_PUBLIC_BASE_URL` environment variable → EU domain (e.g., `https://www.tableicity.eu`)
- [ ] Canonical URL references throughout
- [ ] `middleware.ts` — update domain redirect rules for EU domain
- [ ] City data model — adapt for EU geography (country/region vs state)
- [ ] Content templates — create EU-localized versions
- [ ] Knowledge templates — create EU-localized press release templates

### Must Add (GDPR / EU Compliance)
- [ ] Granular cookie consent (not just Accept/Reject — EU requires category-level consent: necessary, analytics, marketing)
- [ ] Cookie consent must be dismissible without forcing redirect (GDPR requires free choice)
- [ ] Privacy policy page
- [ ] Data processing terms
- [ ] Right to erasure / data deletion workflow
- [ ] Cookie banner must record consent with timestamp

### Should Review
- [ ] Audit logging — verify it meets EU data retention requirements
- [ ] Password policy — consider strengthening beyond default `admin123`
- [ ] Rate limiting — review against EU security standards
- [ ] Data residency — ensure PostgreSQL instance is in EU region
- [ ] Multi-language support — consider adding i18n if targeting non-English EU markets

---

## 8. Key Files Reference

| File | Purpose |
|------|---------|
| `components/homepage/cookie-consent.tsx` | Cookie gateway (redirect URL) |
| `components/homepage/login-panel.tsx` | Login card (app links) |
| `components/homepage/city-marketing-panel.tsx` | City page left panel |
| `app/locations/[slug]/page.tsx` | City landing page (SSR) |
| `app/discovery/knowledge/[slug]/page.tsx` | Press release public page (SSR) |
| `app/admin/knowledge/page.tsx` | Knowledge admin (5 tabs) |
| `app/admin/cities/page.tsx` | City management admin |
| `shared/schema.ts` | Database schema (all tables) |
| `lib/storage.ts` | Database operations (IStorage) |
| `lib/auth.ts` | JWT auth (secure cookie flag) |
| `lib/placeholder-replacer.ts` | Template placeholder substitution |
| `script/build.ts` | Production build (NODE_ENV fix) |
| `middleware.ts` | Domain redirects |
| `app/sitemap.ts` | Dynamic sitemap generation |
| `app/robots.ts` | Dynamic robots.txt |

---

## 9. Environment Variables

| Variable | Purpose | EU Action |
|----------|---------|-----------|
| `DATABASE_URL` | PostgreSQL connection | Point to EU database |
| `SESSION_SECRET` | JWT signing secret | Generate new secret for EU |
| `OPENCAGE_API_KEY` | Geocoding API | Same key works globally |
| `NEXT_PUBLIC_BASE_URL` | Canonical/OG base URL | Set to EU domain |

---

## 10. Summary

The platform has two jobs:

1. **Drive organic traffic** through 150+ SEO-optimized city landing pages and press releases
2. **Redirect visitors** to the actual Cap Table application

The admin dashboard gives you two content engines:
- **City Templates** (under City Management) control the city landing page content
- **Knowledge Templates** (under Knowledge / Press Releases) control the press release content

Both use the same placeholder system. The ideal workflow is: perfect the template first, then apply it across cities via Content Studio, then make surgical per-city edits as needed.

The EU Remix needs to adapt the geography model, update redirect URLs, and add GDPR-compliant consent — but the core architecture transfers directly.
