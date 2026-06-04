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
