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

### MT-1 — Tenant-Aware DB Client (CLOSED 2026-05-09)
- **Code:** 4 new files (`lib/tenant/context.ts`, `lib/tenant/pools.ts`, `lib/tenant/perTenantTables.ts`, `scripts/mt1-verify-guardrail.ts`), 2 modified (`lib/db.ts` is now a tenant-aware proxy wrapper, `server/db.ts` re-exports from it). **239 lines** (target ≤ 300).
- **Behavior change:** None. All 42 existing `import { db } from "@/lib/db"` callsites work unchanged. Tableicity is the hardcoded default tenant via `TENANT_DEFAULT_SLUG` env (defaults to `"tableicity"`).
- **Mechanism:** `search_path` is set via Postgres startup-packet `options="-c search_path=..."` — no event-handler race. `AsyncLocalStorage` threads tenant context; `withTenant(slug, fn)` / `withTenantAsync` available for new code.
- **Refusal guardrail:** Setting `TENANT_DEFAULT_SLUG=""` and running any DB query without a `withTenant` wrapper throws `"Tenant context required: ..."`. Verified.
- **Slug validator:** `^[a-z][a-z0-9_]{0,62}$` enforced at the pool factory. Injection attempt `"; drop schema public; --` rejected. Verified.
- **DoD items, all verified by `npx tsx scripts/mt1-verify-guardrail.ts`:**
  - (a) Sitemap unchanged (dev = 18 URLs, PROD = 84 — no deploy this gate).
  - (b)+(c) App still serves; homepage 200; admin endpoints 401 unauthed (correct).
  - (d) Empty default → throw with clear message.
- **Architect review:** PASS with two non-blocking caveats (search_path race; slug injection). Both fixed in-gate rather than deferred to MT-3 (the dangerous gate).
- **Pending:** Tableicity Custodian visual spot-check on the live admin UI before MT-2 begins.
- **Next:** MT-2 (Platform Tables + `tenant_tableicity` Schema Provisioned) is OPEN, awaiting Conductor "go" signal. Pre-gate dump `John/Dump_MT2_Pre.dump` required first.

### Decisions doc bumped to v1.1 (2026-05-09)
After Conductor reviewed reference screenshots (`attached_assets/Capture_177831*.PNG`), D6 and D7 revised:
- **D6 reverses to public self-serve.** Anyone on `/login` clicks "Create one" → atomic users + tenants + schema + tenant_members create. No OAuth (no Apple / Google / LinkedIn). MFA delivery is log-based for MVP — codes written via `logger.info('mfa.code.issued', ...)` and surfaced on `/login/verify` in a Lab Mode display box. AWS SES integration is explicitly deferred to a post-MT-9 sub-gate.
- **D7 simplified.** Dropped Layout A/B framing. One auth layout: form LEFT (white panel) + brand RIGHT (black panel with `iE` wordmark). Three pages, two flows (2-page returning, 3-page new), both end at `/login/verify`. Landing page unaffected.
- **MT-4 and MT-5 DoDs updated to match v1.1.** MT-0 and MT-1 already closed under v1.0 — not re-opened (the v1.1 changes flow into gates that haven't started yet).
- **Open/deferred (non-blocking for MT-2):** brand tagline, footer wording (ToS/Privacy/Sitemap/address), AWS SES wiring.

### MT-2 CLOSED 2026-05-09 — with mid-gate hardening
**Shipped:**
- `shared/schema.ts` +89 lines: 5 new global tables (`users`, `tenants`, `tenant_members`, `email_verifications`, `city_slug_registry`) with insert schemas + types per fullstack-js conventions. Pushed to dev `public` via `npm run db:push --force`.
- `lib/tenant/provisioner.ts` (98 lines): `provisionTenantSchema(pool, slug)` — atomic (BEGIN/COMMIT with ROLLBACK), idempotent (CREATE IF NOT EXISTS + per-table existence check), uses `LIKE public.<name> INCLUDING ALL` for shell creation. Slug + reserved-word validators at the boundary. Plus `tenantSchemaExists` and `dropTenantSchema` helpers.
- `scripts/mt2-verify.ts` (115 lines): self-contained DoD harness — provisions `tenant_tableicity`, runs 6 invariants, drops on exit. Result: **6/6 PASS**, dev left with no tenant schemas.
- Pre-gate dump `John/Dump_MT2_Pre.dump` (1.86MB PROD baseline).

**Mid-gate hardening (architect review surfaced + fixed in-gate):**
- **Hazard:** MT-1's `search_path="tenant_<slug>",public` order means empty `tenant_<slug>` shells silently SHADOW populated `public.*` reads. Verified live in dev: sitemap dropped 18 → 4 URLs the moment `tenant_tableicity` was created; restored to 18 the moment it was dropped. PROD was unaffected (no deploy occurred). 
- **Resolution:** Deleted the standalone `scripts/mt2-provision.ts` CLI (its very existence was the hazard surface). Made `scripts/mt2-verify.ts` self-contained (provision → check → drop). Added a **Sequencing Rule** to the gate doc: `provisionTenantSchema` runs only inside MT-3's data-move transaction. Added a **hard PROD deploy ban** from MT-2 close until MT-3 close.

**Final state:**
- Dev DB: 5 new global tables in `public`; zero `tenant_*` schemas; sitemap = 18 URLs (unchanged from MT-1 close).
- PROD DB: untouched (deploy banned until MT-3 close).
- Diff: 302 lines (target ≤ 300; 0.7% over, accepted as cost of architect-driven hardening).
- Architect: initial review flagged the hazard + LOC; both addressed before close.

**Next:** MT-3 (data move) — pre-gate dump `John/Dump_MT3_Pre.dump` required. Awaiting Conductor "go MT-3" signal.
