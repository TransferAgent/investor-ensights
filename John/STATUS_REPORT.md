# Tableicity Project Status Report
**Date:** March 20, 2026
**Prepared for:** John (Conductor)

---

## Project Overview

Tableicity is a production-ready marketing platform for cap table management SaaS, featuring 150+ city-specific landing pages, a knowledge/press release system, and an admin dashboard. The site is live at **https://www.tableicity.com**.

---

## Completed Gates

### G2 — SEO Hardening (CLOSED)
- 301 redirect: tableicity.com redirects to www.tableicity.com
- Canonical URLs locked to https://www.tableicity.com on all pages
- Robots "Beast" directive active on all pages
- JSON-LD NewsArticle structured data with image array, Organization author
- Rich Results Test passed with "1 valid item detected" (screenshot on file)
- Sitemap and robots.txt serving correctly on production
- Custom domains verified: tableicity.com + www.tableicity.com

### G5 — Draft Ingestion (CLOSED)
- POST /api/knowledge/draft endpoint fully operational
- Validation: slug format, SEO title/description length, body min 600 chars
- XSS protection: blocks script tags, event handlers, javascript: URLs, iframes
- Rate limiting: 10 drafts/minute per user
- Audit logging with SHA-256 payload hash, IP, user agent, conductor directive
- Always creates "pending" status — never auto-publishes
- Forbidden fields rejected (status, published, archived, datePublished, dateModified)

### G6 — Generation Service (CLOSED)
- POST /api/knowledge/generate-local-vibe endpoint operational
- Reads city data (read-only, no schema coupling to Knowledge)
- Validates output against Zod schema before submitting to draft pipeline
- Calls /api/knowledge/draft internally (localhost only — SSRF-safe)
- Versioned prompt templates (v1 in config/localVibePrompts.ts)
- Zod contract in lib/knowledge/payloadContract.ts

### G7 — Local Vibe Admin Trigger (CLOSED)
- "Generate Local Vibe" button in admin knowledge page
- City dropdown populated from published cities
- Optional directive text field (20% human oversight)
- Creates pending article, shows toast with slug
- Fontana, CA test passed with directive "Focus on cap table audit readiness for US founders and CFOs"

---

## Additional Features Delivered

- **Article Preview**: Pending articles can now be previewed (eye icon on all articles). Preview pages show a yellow "PREVIEW" banner and are marked noindex so Google won't crawl drafts.
- **Inline Image in Fontana Article**: peek.png inserted after paragraph 2, floats right at ~45% width, text wraps left, identified as "Tableicity Cap Table" for Google.
- **Middleware Fix**: Bare domain redirect no longer appends :5000 port (was causing tableicity.com to fail in browsers).

---

## Production Assets

| Item | Location |
|------|----------|
| Live site | https://www.tableicity.com |
| Admin panel | https://www.tableicity.com/admin/knowledge |
| Fontana article (pending) | https://www.tableicity.com/discovery/knowledge/fontana-ca-local-vibe-1773986632855 |
| Test press article (published) | https://www.tableicity.com/discovery/knowledge/tableicity-test-press-001 |
| Zod schema | lib/knowledge/payloadContract.ts |
| Prompt template v1 | config/localVibePrompts.ts |
| Admin credentials | admin / admin123 |

---

## Remaining Gates (Pending Architect Orders)

### G8 — Asset Library (NOT STARTED)
Curated image library with tags, OG/hero selection, admin override.

### G9 — Discover Polish (NOT STARTED)
OG image min-width enforcement, publish cadence dashboard, block publishing on missing image.

---

## Next Steps — What John Needs to Provide

### Immediate (to close G6/G7 evidence for Architect)
1. **Publish the latest deployment** (middleware fix for bare domain redirect)
2. **Review the Fontana preview article** at the link above — confirm content and image placement look correct
3. **Publish the Fontana article** via admin panel (click the green arrow icon)
4. **Run Rich Results Test** on the published Fontana URL and screenshot the result for the Architect evidence package
5. **Send Architect the G6/G7 evidence package:**
   - Live Fontana URL
   - Rich Results Test screenshot
   - Prompt template (config/localVibePrompts.ts — v1)
   - Zod schema (lib/knowledge/payloadContract.ts)

### For G8 (Asset Library) — Architect specs needed
- What image categories/tags should be supported?
- Should images be uploaded to the server or referenced by external URL?
- How should the admin select and assign images to articles?
- Should there be a minimum resolution requirement (e.g., 1200px wide)?

### For G9 (Discover Polish) — Architect specs needed
- Should missing OG image be a hard block on publishing, or just a warning?
- What does the "publish cadence dashboard" look like? (e.g., articles per week chart, upcoming scheduled publishes)
- Any additional SEO checks before allowing publish?

### General
- Any new cities to add beyond Fontana?
- Any changes to the prompt template wording for Local Vibe articles?
- Any branding/design feedback on the article page layout?
- Consider changing the default admin password before going fully public

---

## Safety Locks (Permanent)
These are locked forever per Architect directive:
1. **Knowledge and Locations are separate** — no schema coupling, read-only city access
2. **Pending-only** — all generated content goes through /api/knowledge/draft, never direct DB write, never auto-publish
3. **Canonical host** — locked to https://www.tableicity.com, never non-www

---

## Multi-Tenant Build — Gate Closures

### MT-0 — Decisions Lock + Doc (CLOSED 2026-05-09)
- Conductor locked decisions D1–D12 as written by the Architect.
- Artifacts shipped: `John/Locked_Gate_Table_MultiTenant_v1.0.md` (296 lines), `replit.md` Multi-Tenant Architecture section + 3 new Gotchas (forward-only-deletes, never-touch-slugs, sitemap-as-canary).
- Zero code changes. Production unaffected. Sitemap = 84 URLs.
- Next: MT-1 (Tenant-Aware DB Client) is OPEN, awaiting Conductor "go" signal.
