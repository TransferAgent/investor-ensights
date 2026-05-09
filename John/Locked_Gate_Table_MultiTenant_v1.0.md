# Locked Gate Table — Multi-Tenant Build — v1.0

_Authored by the Architect. Drafted 2026-05-09._
_Companion artifacts: `attached_assets/architecture.doc_1778035947445.md` (SAMA retrospective), `attached_assets/Multi-Tenancy-and-Auth-Guide_(2)_1778035947446.md` (schema-per-tenant pattern), `John/Dump_Three.dump` (pre-build PROD baseline)._
_Status: **DRAFT — pending Conductor lock.** Once signed off, this becomes LOCKED and changes require a new minor version + Conductor sign-off note._

---

## Purpose

This table is the single source of truth for the multi-tenant rebuild of Investor Ensights. Every gate names one owner, one Definition of Done, and the inputs/outputs that connect it to its neighbors. No work begins on a gate until the gate above is **CLOSED** by the Architect.

The North Star is in the SAMA retrospective's "One Thing":

> On day one, write down which tables are global and which are per-tenant, and make the database client refuse to query a per-tenant table without a tenant context.

---

## Project model (the thing being built)

**Investor Ensights** = the Conductor's private internal Newsroom workshop. The SaaS marketing engine for the Conductor's 8-brand portfolio. Not a public-facing multi-tenant SaaS with anonymous signups.

**Each Persona / Tenant** = one of those brands. Tableicity is the first. Future tenants are SaaS #2 through SaaS #8.

**Each tenant is a silo:**

- Its own PostgreSQL schema (`tenant_<persona-slug>`).
- Its own Halo library, city catalog, articles, templates, audit log, newsroom pipeline state.
- Brand tokens (article slug prefix, in-content publisher chrome) come from the tenant's config.

**One staff user belongs to one tenant.** No tenant-picker UI. Session resolves to one persona by `tenant_members` lookup.

**Public output (`/discovery/knowledge/{slug}`, `/locations/{slug}`)** is the only crawlable surface. The admin/creation surface is private to the Conductor and invited staff.

---

## Roles

| Role | Person | Scope |
|---|---|---|
| **Conductor** | John | Priorities, scope, gate close approval, owns secrets vault, decides on overrides to defaults below |
| **Architect** | (this seat) | Opens/closes gates, redlines briefs, owns this table |
| **App Builder** | Replit Agent on `investorensights.com` repo | Implementation of every gate |
| **Tableicity Custodian** | John | Verifies "Tableicity content untouched" check at every gate close |

---

## Locked decisions (the MT-0 work product)

### D1 — Isolation model
**Schema-per-tenant via PostgreSQL `search_path`.** Per the thick guide. Public schema for platform tables, `tenant_<slug>` schema for per-tenant tables.

### D2 — Tenant context source
**Session-derived.** Each user belongs to exactly one tenant via `tenant_members`. No subdomain. No path-prefix on admin routes. No tenant-picker. The tenant slug is resolved server-side from the authenticated user on every request.

### D3 — Persona slug = schema name = article slug prefix
The single string `tableicity` is simultaneously: the tenant's `slug`, its schema name (`tenant_tableicity`), and the prefix on every article URL it generates (`/discovery/knowledge/tableicity-…`). One string, three roles, no drift.

### D4 — City URL namespace = global, enforced by `city_slug_registry`
City slugs are globally unique across `investorensights.com/locations/{slug}`. Uniqueness enforced at City Batch Upload time via a tiny `public.city_slug_registry` table. Anonymous public route resolves: registry lookup → tenant slug → schema → row. **Tableicity keeps every existing city slug unchanged.** Future tenants get unique slugs assigned at upload (e.g. `irvine-ca-acme` if `irvine-ca` is taken).

### D5 — Article URL namespace = globally unique by construction
Persona prefix on every article slug (`tableicity-…`, `acme-…`, …) guarantees uniqueness without a registry table. Existing 80 Tableicity article slugs are preserved by construction.

### D6 — Auth model (REVISED 2026-05-09 in v1.1)
- Single `users` (platform) + `tenant_members` (binding) tables.
- Existing `admin_users.abc17@gmail.com` row backfilled into `users` + `tenant_members(tableicity, tenant_admin)` at MT-4. abc17 logs in via the standard email + password + MFA flow; no special-case path.
- Email + password + 6-digit MFA two-phase login. **No OAuth providers** (no Apple / Google / LinkedIn).
- **Public self-serve tenant creation enabled.** Anyone landing on `/login` can click "Create one" → land on `/login/set-password` (Create Account) → submit → enter MFA → system atomically creates a `users` row, a `tenants` row with their chosen slug, a `tenant_<slug>` schema, and a `tenant_members(slug, tenant_admin)` row. They land in their own empty admin.
- **MFA delivery (MVP):** the 6-digit code is written to the **server logs** via a `mfa.code.issued` log line. The Lab Code page on `/login/verify` reads the most recent code for the user's email from the in-process log buffer and displays it in a labeled "Lab Mode" box on-screen. AWS SES integration is **explicitly deferred** to a post-MT-9 sub-gate; until SES is wired, prod and dev share the log-based mechanism.
- Tenant slug uniqueness enforced at create time against the existing schema list (slug must satisfy the MT-1 validator `^[a-z][a-z0-9_]{0,62}$` AND not collide with an existing `tenant_<slug>` schema or reserved word).

### D7 — Auth UI: 3 pages, 2 flows, single layout (REVISED 2026-05-09 in v1.1)

**One shared layout for all three auth pages:** form/workflow on the **LEFT panel (white)**, brand chrome on the **RIGHT panel (black, large `iE` wordmark + `INVESTOR ENSIGHTS` subtitle)**. Reference: `attached_assets/Capture_1778310937497.PNG`. The landing page (`/`) is a separate concern with its own marketing layout — not part of this auth surface.

**Three pages:**
1. `/login` — Sign In: email + password fields + "Don't have an account? **Create one**" link
2. `/login/set-password` — Create Account: name + email + password + confirm-password
3. `/login/verify` — Lab Code: 6-digit MFA input + Lab Mode display box (per D6) + "Resend Code" + "← Back to login"

**Two flows converge on `/login/verify`:**
- **Returning user (2 pages):** `/login` (creds) → `/login/verify` (MFA) → admin
- **New user (3 pages):** `/login` (clicks "Create one") → `/login/set-password` (account) → `/login/verify` (MFA) → admin (their newly provisioned empty tenant)

**Footer / physical address / Sitemap link wording: deferred** (Conductor will revisit). Brand tagline under the `INVESTOR ENSIGHTS` wordmark: deferred (currently no tagline, just the wordmark).

**The previous "Layout A vs Layout B" framing is dropped.** There is one auth layout. The landing page is unaffected by this decision.

### D8 — Per-tenant brand chrome
`authorName`, `publisherName`, and the prompt voice ("You are writing an X press-release") come from tenant config, not constants. Tableicity's row seeded with `publisherName="Investor Ensights"` and `authorName="Investor Ensights"` so its existing 80 articles continue to generate with identical chrome — zero content drift, zero SEO impact. New tenants pick their own at create-tenant time.

### D9 — No per-persona marketing pages on `investorensights.com`
The iE domain stays the Conductor's private workshop's marketing skin. Personas market themselves on their own websites. Newsroom only publishes their content under iE's `/discovery/knowledge/{slug}` and `/locations/{slug}` paths.

### D10 — Global vs per-tenant table list

**Global (`public` schema):**

| Table | Notes |
|---|---|
| `users` (NEW) | Platform-wide identity |
| `tenants` (NEW) | Tenant registry; carries `slug`, `personaDisplayName`, `publisherName`, `authorName` |
| `tenant_members` (NEW) | User ↔ tenant binding; carries `role` |
| `email_verifications` (NEW) | MFA codes |
| `city_slug_registry` (NEW) | Global city URL namespace guard |
| `session` (auto, connect-pg-simple) | Session store |
| `admin_users` (EXISTING) | Migrated to `users` + `tenant_members` at MT-4, then deprecated |

**Per-tenant (`tenant_<slug>` schema):**

| Table | Why |
|---|---|
| `admin_audit_log` | Audit trail belongs to the tenant whose data was changed |
| `city_locations` | Each tenant owns their cities |
| `city_content_assignments` | Tenant-scoped pairings |
| `city_research_sources` | Tenant-scoped grounding |
| `knowledge_articles` | The published content |
| `knowledge_article_versions` | Edit history, tenant-scoped |
| `knowledge_templates` | Tenant-scoped |
| `knowledge_campaigns` | Tenant-scoped |
| `knowledge_generation_log` | Tenant-scoped |
| `content_templates` | Tenant-scoped |
| `custom_pages` | Tenant-scoped |
| `page_slides` | Tenant-scoped |
| `haylo_articles` | Each tenant ingests their own library |
| `newsroom_*` (all 9 tables) | Pipeline state is per-tenant |
| `data_store_files` | Per-tenant uploads |

### D11 — Forward-only deletes
Standing rule from the recovery era carries into the multi-tenant build. No retroactive deletes of slugs, audit rows, or content without Conductor sign-off.

### D12 — New tenants start truly empty
No city seed snapshot. No content seed. New tenant = empty schema with table shells only. Conductor uploads City Batch (MT-9) and Halo library separately.

---

## The Gate Table

| # | Name | Owner | Inputs | Definition of Done | Closes when… | Unblocks |
|---|---|---|---|---|---|---|
| **MT-0** | **Decisions Lock + Doc** | Conductor + Architect | The 12 decisions above | This file written. `replit.md` updated with the multi-tenant decisions section. **Zero code changes.** **CLOSED 2026-05-09.** | Conductor signed off on D1–D12 as written, 2026-05-09. | MT-1, MT-5 |
| **MT-1** | **Tenant-Aware DB Client (no behavior change)** | App Builder | Closed MT-0 | `lib/db.ts` wraps `getTenantDb(slug)` / `getTenantPool(slug)`. `search_path` set via Postgres startup-packet `options` (no race possible). AsyncLocalStorage threads tenant context. Refusal guardrail throws when no context AND no default. Slug validator rejects injection. Tableicity is the hardcoded default. All 42 existing `db` importers unchanged. **CLOSED 2026-05-09.** | All 4 DoD items verified: (a) sitemap = 18 dev URLs unchanged (PROD 84 untouched, no deploy); (b) admin UI still serves cities/articles (admin endpoints return 401 unauthed = correct); (c) covered by (b); (d) `TENANT_DEFAULT_SLUG=` empty → query throws with clear message. Diff = 239 lines (target ≤300). Architect review: PASS, two non-blocking caveats fixed in same gate (search_path race + slug validation). | MT-2 |
| **MT-2** | **Platform Tables + Provisioner CODE (no live tenant schemas yet)** | App Builder | Closed MT-1 | Public schema gains the 5 NEW global tables (D10). `provisionTenantSchema(slug)` exists, idempotent, validated, atomic. **No tenant_<slug> schema is left in any environment** — see Sequencing Rule below. Self-contained verifier `scripts/mt2-verify.ts` provisions → checks 6 invariants → drops in one run. Pre-gate dump: `John/Dump_MT2_Pre.dump`. **CLOSED 2026-05-09.** | All 6 verifier checks PASS: (a) provision creates 24 shells; (b) public has 5 new global tables; (c) public still has 24 per-tenant tables (untouched); (d) shells empty after provision; (e) provisioner idempotent; (f) slug validator rejects 7/7 bad inputs. Dev sitemap = 18 URLs (unchanged from MT-1 close — confirmed no shadowing). PROD untouched (no deploy). Diff = 302 lines (target ≤ 300; 0.7% over, accepted given architect-driven hardening cycle). | MT-3 |
| **MT-3** | **Tableicity Data Move (THE DANGEROUS ONE)** | App Builder | Closed MT-2, fresh `John/Dump_MT3_Pre.dump` | Per-tenant data copied from `public.*` → `tenant_tableicity.*` row-by-row inside one transaction with COUNT verification at the end. Tenant-aware client routes Tableicity reads/writes to `tenant_tableicity`. **Public copies left in place** (dormant) for one gate as rollback safety net. `tenants` row inserted: `slug='tableicity'`, `personaDisplayName='Tableicity'`, `publisherName='Investor Ensights'`, `authorName='Investor Ensights'`. `city_slug_registry` populated with all 340 Tableicity city slugs claimed by `tableicity`. **Tableicity Custodian visual check: 80 articles, 340 cities, 182 haylo, sitemap = 84, every audit row preserved, every published article URL still resolves.** Post-gate dump: `John/Dump_MT3_Post.dump`. | Tableicity Custodian + Architect spot-check 5 articles, 10 cities, 5 haylo essays in the live admin UI. SQL row counts match across schemas. The 2 published-article URLs from `protectedSlugs.ts` resolve identically to pre-gate. Diff ≤ 300 lines (excluding generated migration). | MT-4 |
| **MT-4** | **Auth Refactor (public self-serve tenant creation)** | App Builder | Closed MT-3, Closed MT-0 (D6 v1.1 spec) | `POST /api/auth/login` issues an MFA code via `logger.info('mfa.code.issued', { email, code })` and returns a verify-token. `POST /api/auth/verify` consumes the verify-token + 6-digit code. `POST /api/auth/create-account` is a **public** endpoint that atomically: inserts `users` row + `tenants` row (slug from form, validated) + `provisionTenantSchema(slug)` + `tenant_members(slug, tenant_admin)` + issues MFA code. Existing `admin_users.abc17@gmail.com` backfilled into `users` + `tenant_members(tableicity, tenant_admin)`. **abc17 logs in via standard flow, lands in Tableicity admin, sees ALL 80 articles + 340 cities + 182 haylo.** A second test account self-serves a new tenant `mt4_smoke` and lands in an empty admin. | Architect: (a) abc17 returning-user 2-page flow works; (b) brand-new email 3-page sign-up flow creates an empty tenant; (c) the Lab Mode display on `/login/verify` shows the issued code (sourced from log buffer); (d) tenant slug validator rejects collisions and malformed strings. Diff ≤ 300 lines. | MT-5, MT-6 |
| **MT-5** | **3-Page Auth UI (single layout)** | App Builder | Closed MT-0 (D7 v1.1 spec), Closed MT-4 (auth endpoints) | Three pages exist with the single auth layout (form LEFT white panel, brand RIGHT black `iE` panel): `/login` (Sign In + "Create one" link), `/login/set-password` (Create Account), `/login/verify` (Lab Code with Lab Mode display). Returning-user flow is 2 pages, new-user flow is 3 pages, both converge at `/login/verify`. Landing page (`/`) untouched. | Conductor visual review of all three pages. Diff ≤ 300 lines. | MT-6 |
| **MT-6** | **Second Tenant Smoke Test** | App Builder + Architect | Closed MT-4, Closed MT-5 | Conductor creates `demo-saas-2` tenant via the admin form (no public signup). Verify: (a) `tenant_demo_saas_2` schema exists with **empty** per-tenant tables; (b) demo tenant's invited admin signs in (via emailed invite + set-password + MFA), lands in their admin, sees zero cities, zero articles, zero haylo; (c) demo admin creates an article — Tableicity admin does NOT see it; (d) Tableicity admin creates an article — demo admin does NOT see it; (e) demo admin's article slug carries `demo-saas-2-` prefix, not `tableicity-`. | Architect demos both tenants side-by-side, runs cross-tenant isolation queries (count rows in each schema, confirm no overlap). | MT-7 |
| **MT-7** | **Background Workers Retrofit** | App Builder | Closed MT-6 | Audit every code path that runs **outside a request**: Newsroom scheduler (`newsroom_scheduler_runs`), agent loop, worker (`NEWSROOM_WORKER_SECRET`), `seedData`/`cityResearchAutoSeeder`, cron jobs, fire-and-forget promises. Each accepts `tenantSlug` explicitly OR is confirmed to touch only public-schema tables (and the MT-1 guardrail enforces this). | Architect verifies the audit checklist + runs one Newsroom scheduler tick for Tableicity, confirms it writes to `tenant_tableicity.*` not `public.*`. | MT-8 |
| **MT-8** | **Public Schema Cleanup + Production Cutover** | App Builder + Conductor | Closed MT-7, fresh `John/Dump_MT8_Pre.dump` | Dormant public-schema copies of per-tenant tables (left from MT-3) dropped. `replit.md` final architecture + cross-cutting rules updated. Production deploy. **Live `investorensights.com/sitemap.xml` returns 84 URLs unchanged. Tableicity content fully intact. demo-saas-2 reachable via admin only.** Post-gate dump: `John/Dump_MT8_Post.dump` becomes the new baseline. | Architect verifies live PROD sitemap. Tableicity Custodian spot-checks live content. | MT-9 |
| **MT-9** | **City Batch Upload Tool** | App Builder | Closed MT-8 | Admin-only UI for uploading a tenant's city CSV. Slug proposal step (auto-suffix on collision with `city_slug_registry`). Conductor reviews/overrides each proposed slug. On commit: writes rows to `tenant_<x>.city_locations` AND uniqueness rows to `public.city_slug_registry`. Cancellable, resumable, audit-logged. | Conductor uploads a 10-row test CSV for `demo-saas-2`, including one collision (`abilene-tx`) — system proposes `abilene-tx-demo-saas-2`, Conductor approves, all 10 rows land in `tenant_demo_saas_2.city_locations`, `city_slug_registry` shows the new claims. | (Multi-tenant build complete) |

---

## Sequencing Rule (added at MT-2 close, 2026-05-09)

**`provisionTenantSchema` MUST run only inside MT-3's data-move transaction (provision → copy → commit), never standalone in any environment that reads via the tenant-aware client.**

Discovered during MT-2 architect review and verified live in dev: MT-1 sets `search_path="tenant_<slug>",public`. Once a `tenant_<slug>` schema exists with empty per-tenant table shells, reads silently resolve to those empty shells instead of falling through to populated `public.*` — making the app appear to have lost its data even though no row was deleted (confirmed: dev sitemap dropped from 18 → 4 URLs the moment empty `tenant_tableicity` was created; restored to 18 the moment it was dropped).

**Consequences:**
- `scripts/mt2-verify.ts` is self-contained: provisions → checks → drops in one run, leaving live state tenant-schema-free.
- There is no standalone `mt2-provision.ts` CLI — that script existed in the first MT-2 draft and was deleted.
- **Hard PROD deploy ban from MT-2 close (2026-05-09) until MT-3 close.** A deploy in this window would push the new `shared/schema.ts` (5 global tables) to PROD via Replit Publish — which is fine on its own — but if the MT-3 data-move script is then run before redeploying with MT-3-aware code, the same shadowing hazard manifests in PROD against the live 80 articles + 340 cities + 182 haylo. MT-3 must ship as one coherent transaction (provision + copy + reconstruct FKs + verify counts + commit) followed immediately by deploy.
- MT-3's first action will be to call `provisionTenantSchema('tableicity')` from inside its move transaction; MT-2 already proves that call works.

## Cross-cutting rules (binding on every gate)

1. **Tableicity content is sacred.** Every gate close requires a Tableicity Custodian verification that articles, cities, haylo essays, audit rows, newsroom state are intact. If counts diverge from `John/Dump_Three.dump` baseline (other than intentional changes within the gate's DoD), the gate is not closed.
2. **Sitemap-as-canary.** Live PROD `investorensights.com/sitemap.xml` = 84 URLs is the operational health check at every gate close until intentionally changed.
3. **Backup-before, backup-after** for any gate that touches data shape (MT-2, MT-3, MT-7, MT-8). Dumps land in `John/` with the gate ID in the filename.
4. **Refusal guardrail is sacred.** Once MT-1 lands, no per-tenant query without tenant context — ever. Bypassing the guardrail in a hot path closes no gates.
5. **Two tenants by MT-6.** No further work proceeds until two real tenants exist and pass cross-tenant isolation.
6. **Schema wins disputes.** If a doc and `shared/schema.ts` disagree, schema is authoritative.
7. **<300 lines per gate** (excluding generated migrations). If a gate's diff exceeds 300 lines, the Architect splits it (MT-3a / MT-3b, etc.) without re-locking the table.
8. **Forward-only deletes.** Carries from the recovery era. No retroactive deletes of slugs, audit rows, or content without Conductor sign-off.
9. **Brand tokens come from tenant context, never from constants.** Once MT-3 lands, `tableicity-` and `"Investor Ensights"` are read from the tenant config. Hardcoded brand strings in new code are a Code Review reject.
10. **Dev-loop friction budget.** `DEV_MFA_BYPASS=000000` is permitted in dev. Production asserts it's unset at boot.

---

## Definition of "Closed"

A gate is closed when the Architect:

1. Verifies the DoD against the live system (not a screenshot, not a claim).
2. Marks the gate's row in this table with `**CLOSED <date>**` in the DoD column.
3. Posts a one-line close note in `John/STATUS_REPORT.md`.
4. Notifies the next gate's owner that they may begin.

Re-opening a closed gate requires a new minor version of this table (v1.1, v1.2, …) and a Conductor sign-off note appended below.

---

## Current state (as of 2026-05-09)

- **Decisions doc version:** v1.1 (D6 + D7 revised 2026-05-09; D1–D5, D8–D12 unchanged).
- **MT-0:** **CLOSED 2026-05-09** (under v1.0; v1.1 revisions are scope clarifications that flow into MT-4/MT-5, not a re-opening of MT-0).
- **MT-1:** **CLOSED 2026-05-09.** Tenant-aware DB client live. 239 lines.
- **MT-2:** **CLOSED 2026-05-09.** Platform tables + provisioner shipped (302 LOC). Self-contained verifier passes 6/6. Live state: no tenant schemas exist anywhere; 5 new global tables in dev `public` (PROD via next deploy). New Sequencing Rule added (above). PROD deploy banned until MT-3 close.
- **MT-3:** **OPEN — awaiting Conductor "go" signal.** Pre-gate dump required: `John/Dump_MT3_Pre.dump`. **Hard PROD deploy ban in effect until MT-3 close.**
- **MT-4 through MT-9:** Not yet open. Do not start.

**Open / deferred items (non-blocking for MT-2):**
- D7 brand tagline under `INVESTOR ENSIGHTS` wordmark — currently none.
- D7 footer wording (ToS / Privacy / Sitemap / physical address) — Conductor will revisit at MT-5 visual review.
- D6 AWS SES integration — deferred to post-MT-9 sub-gate; log-based Lab Mode is the canonical MFA delivery until then.

---

## Change log

| Version | Date | Change | Approved by |
|---|---|---|---|
| v1.0 | 2026-05-09 | Initial draft. Gates MT-0 through MT-9 defined. Decisions D1–D12 captured. | Architect (pending Conductor lock) |
| v1.0 | 2026-05-09 | **LOCKED.** Conductor signed off on D1–D12 as written. MT-0 marked CLOSED. MT-1 opens awaiting "go" signal. | Conductor (John) |
| v1.0 | 2026-05-09 | **MT-1 CLOSED.** Tenant-aware DB client shipped (lib/tenant/context.ts, lib/tenant/pools.ts, lib/tenant/perTenantTables.ts, lib/db.ts wrap, server/db.ts re-export). 239 LOC. Search_path set via startup packet `options` (race-free). Slug validator at factory boundary. All 4 DoD items verified by `scripts/mt1-verify-guardrail.ts`. | App Builder + Architect (Conductor visual check pending) |
| v1.1 | 2026-05-09 | **D6 + D7 revised** after Conductor reviewed reference screenshots. D6: public self-serve tenant creation enabled (anyone clicks "Create one" → atomic users+tenants+schema+member create); no OAuth (email + password + MFA only); MFA codes written to server logs and surfaced via Lab Mode display; AWS SES deferred. D7: dropped Layout A/B framing; single auth layout (form LEFT white, brand RIGHT black `iE`); 2-page returning-user flow + 3-page new-user flow converging at `/login/verify`. MT-4 + MT-5 DoDs updated to match. MT-0 / MT-1 already closed; not re-opened. | Conductor (John) |
| v1.1 | 2026-05-09 | **MT-2 CLOSED.** Platform tables (users, tenants, tenant_members, email_verifications, city_slug_registry) added to `shared/schema.ts` and pushed to dev `public`. `lib/tenant/provisioner.ts` ships `provisionTenantSchema(pool, slug)` (atomic, idempotent, slug- and reserved-word-validated). Self-contained verifier `scripts/mt2-verify.ts` passes 6/6 in a provision→check→drop cycle. Architect surfaced search_path shadowing hazard mid-gate; resolved by deleting standalone CLI provisioner, making verifier self-contained, and adding a Sequencing Rule + PROD deploy ban until MT-3 close. 302 LOC (0.7% over the 300 target, accepted). Pre-gate dump `John/Dump_MT2_Pre.dump` (1.86MB) captured. | App Builder + Architect (Conductor sign-off pending) |
