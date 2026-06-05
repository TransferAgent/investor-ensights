---
name: Dev vs Prod ownership boundary
description: Who operates which environment on Investor Ensights, and the hard rule about agent writes to prod.
---

# Dev/Prod ownership (Investor Ensights)

**Rule:** Dev is the agent's environment; Prod is the user's. The user (Conductor)
operates the Production live site directly. The agent builds and tests in Dev only.

**Why:** Stated explicitly by the user 2026-06-04 ("Dev is for you and Prod is for me
— I work in Production — you work in Dev"). Dev and Prod are separate Postgres DBs.

**How to apply:**
- Build + dry-run + verify in Dev. Do NOT run write/commit operations against Prod
  (PROD_DATABASE_URL) unless the user explicitly asks. Read-only prod queries for
  verification are fine.
- Dev and Prod data diverge. Example: the Tableicity Haylo library has ~80+ rows in
  Prod but only 1 (unrelated) row in Dev. To test a Prod-representative flow, mirror
  the needed Prod data into Dev rather than pointing dev code at Prod.
- Prod schema/data changes are propagated by the user (or via the documented
  `push-schema-to-prod.sh` / `sync-dev-to-prod.ts`) — the agent prepares, the user ships.

**Tenant divergence (2026-06-05):** Dev `public.tenants` has only **tableicity**; the
other personas (haylo/payrol/texitie/veltroy) exist only on PROD. So any per-persona
rollout (e.g. city-meta backfill) can be dry-run in dev for tableicity only; the rest
are blocked on onboarding. City meta is **data-gated** on `tenants.default_haylo_article_id`
(the "truth doc") — no pointer ⇒ generator no-ops, page keeps its render fallback. Dev
tableicity cities are intentionally NOT fully backfilled (PROD is the source of truth at
340/340); don't pay OpenAI to regenerate dev rows that aren't user-facing.
