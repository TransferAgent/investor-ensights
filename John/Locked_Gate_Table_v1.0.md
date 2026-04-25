# Locked Gate Table — v1.0

_Authored by the Architect. Ratified 2026-04-25._
_Companion artifacts: `Newsroom_Worker_Contract_v1.1.md`, `Halo_Integration_Memo.md` (v0.2), `Engineer_1_Gate_1_Brief.md`._
_Status: **LOCKED**. Changes require a new version number and Conductor sign-off._

---

## Purpose

This table is the single source of truth for the Newsroom POC build order. Every gate names one owner, one Definition of Done, and the inputs/outputs that connect it to its neighbors. No engineer starts work until the gate above theirs is closed by the Architect.

If a gate's DoD is not met, the gate is not closed. There is no "mostly done." There is no parallel work across gates without an explicit Architect waiver attached to this document.

---

## Roles

| Role | Person | Scope |
|---|---|---|
| **Conductor** | John | Priorities, scope, approve/reject gate closes, owns the secrets vault. |
| **Architect** | (this seat) | Opens/closes gates, owns the table, resolves spec conflicts, redlines memos. |
| **App Builder** | Replit Agent on the shell repo (`tableicity.com`) | Owns the Next.js shell, the 7 worker endpoints, the admin UI, the database schema. Authors briefs. |
| **Engineer 1 (Platform)** | TBD by Conductor | Owns the worker loop, claim/heartbeat/runs/review plumbing. Gate 1. |
| **Engineer 2 (Researcher)** | TBD by Conductor | Owns scrape pipeline + `newsroom_source_documents`. Gate 2 (left half). |
| **Engineer 3 (Analyst)** | TBD by Conductor | Owns lead signals + `newsroom_lead_signals`. Gate 2 (right half). |
| **Engineer 4 (Halo Adapter)** | Engineer 2 or 3, Conductor's call | Owns `worker/halo_client.py`. Gate 2.5. |
| **Engineer 5 (Copywriter + SEO/QC)** | TBD | Owns prompt assembly, draft generation, QC scoring. Gate 3. |
| **Reviewer (HITL)** | John + designate | Approves/rejects drafts in `/admin/newsroom/review`. Gate 4. |

---

## The Gate Table

| # | Name | Owner | Inputs | Definition of Done | Closes when… | Unblocks |
|---|---|---|---|---|---|---|
| **0** | **Shell + Schema + Endpoints** | App Builder | — | 7 worker endpoints live, all DB tables migrated, admin UI shows empty queues, `NEWSROOM_WORKER_SECRET` provisioned, dry-run filter chip wired at `/admin/newsroom`. | **CLOSED 2026-04-23.** | Gate 1 |
| **1** | **Database + Worker Skeleton (dry-run)** | Engineer 1 | Brief + Contract v1.1 + secret. | A `dryRun=true` job is claimed, flows through 5 fixture stages emitting 5 audit rows (zero tokens, zero cost), heartbeats at least once, posts a fixture draft to `/review`, and lands in `/admin/newsroom/review` as `pending`. Full checklist in `Engineer_1_Gate_1_Brief.md`. | Architect verifies the visual checklist on prod (or the Conductor's chosen test environment) and signs off in this row. | Gate 2 |
| **2** | **Researcher + Analyst (real scrape, no LLM)** | Engineers 2 & 3 in parallel | Closed Gate 1, Contract v1.1 §"Direct-DB row shapes". | Researcher writes ≥1 real row to `newsroom_source_documents` from a live scrape of one fixture city; Analyst writes ≥1 real row to `newsroom_lead_signals` from a public source (Crunchbase or SEC). Still no LLM calls. Both agents heartbeat correctly and respect the dry-run flag (skip when true). | Architect spot-checks 3 source rows + 3 signal rows for a single city, confirms no PII leaks and no ToS-prohibited domains. | Gate 2.5, Gate 3 |
| **2.5** | **Halo Enrichment Adapter** | Engineer 4 | Closed Gate 2, `Halo_Integration_Memo.md` v0.2, `HALO_*` env vars set. | `worker/halo_client.py` implements `/search` and `/qa-pairs` against the persona-scoped Halo API, with the conditional fallback decision tree (score > 0.75 trust, else scrape), 3s timeout, single retry, 24h cache in `newsroom_agent_knowledge`, and the `HALO_ENRICHMENT_ENABLED=false` kill-switch is bit-identical to a no-Halo world. | Architect verifies: (a) flag-off run produces zero Halo calls in network logs; (b) flag-on run with Halo down still completes the job; (c) cache hit on second identical query. | Gate 3 (quality lever only — Gate 3 may proceed without 2.5 if the Conductor accepts no-Halo articles for Tier A) |
| **3** | **Copywriter + SEO/QC (real LLM)** | Engineer 5 | Closed Gate 2 (mandatory), Closed Gate 2.5 (optional but recommended). | A non-dry-run job for one city produces a real draft via Anthropic, scored by SEO/QC, posted to `/review`. Token spend logged on the agent run row. Draft passes `newsroomDraftPayloadV1Schema` validation. Halo qa-pairs visibly injected into the prompt when 2.5 is closed. | Architect reads 3 generated drafts end-to-end and confirms they're publishable after light human edits. Reject if any draft would embarrass the brand. | Gate 4 |
| **4** | **HITL Review + Publish** | App Builder + Reviewer | Closed Gate 3. | Reviewer can approve a draft from `/admin/newsroom/review`, which writes a `knowledge_articles` row in `pending` status; the existing publish flow (`POST /api/admin/knowledge/[id]/publish`) takes it from there. Reviewer can reject with notes; rejected drafts re-queue or close per reviewer's choice. Audit trail captured. | First real article reaches `published` status via this flow and renders correctly at `/discovery/knowledge/{slug}`. | Gate 5 |
| **5** | **GSC Heal Loop (Tier B)** | Engineer 5 + App Builder | Closed Gate 4 + 14 days of GSC data on Newsroom-published articles. | Underperforming articles (impressions > N, CTR < M) are auto-re-enqueued for rewrite. Researcher scrapes in parallel with Halo (per Halo Memo v0.2 Tier B caveat). Rewritten draft enters the same HITL queue. | Architect confirms one rewrite cycle completes and the rewritten article ships. **This gate is post-POC.** | Tier C decisions (write-back to Halo, multi-tenant, etc.) |

---

## Cross-cutting rules (binding on every gate)

1. **Dry-run is sacred.** Every gate's worker code MUST behave bit-identically when `dryRun=true`: zero LLM calls, zero outbound HTTP except to the shell, deterministic output. Violations close no gates.
2. **Lease discipline.** A `409` from `/heartbeat` means the lease is lost. The worker MUST stop, MUST NOT write any more rows for that job, and MUST re-claim. No exceptions.
3. **Schema wins disputes.** If a doc and `shared/schema.ts` disagree, the schema is authoritative. File a doc bug; do not bend the schema.
4. **No silent failures.** Optional integrations (Halo) log `INFO` on failure and continue. Required integrations (DB writes, shell endpoints) raise and stop the job. Never `try/except: pass`.
5. **Persona lock.** Every Halo call carries `persona=tableicity`. Hardcoded. No per-job override path exists in the codebase.
6. **Audit trail is non-negotiable.** Every agent invocation produces a row in `newsroom_agent_runs`. Every job state change produces an `admin_audit_log` row when triggered by a human, or is captured on the job row itself when triggered by the worker.
7. **Production secrets come from the Conductor.** No engineer puts a key in code, in a doc, or in a chat. Conductor sets it on Replit; the worker reads from env.

---

## Definition of "Closed"

A gate is closed when the Architect:

1. Verifies the DoD against the live system (not a screenshot, not a claim).
2. Marks the gate's row in this table with `**CLOSED <date>**` in the DoD column.
3. Posts a one-line close note in the project log (or `John/STATUS_REPORT.md`).
4. Notifies the next gate's owner that they may begin.

Re-opening a closed gate requires a new minor version of this table (v1.1, v1.2, …) and a Conductor sign-off note appended below.

---

## Current state (as of 2026-04-25)

- **Gate 0:** CLOSED.
- **Gate 1:** OPEN. Engineer 1 not yet seated. Brief and Contract v1.1 ready in `John/`. Secret provisioned.
- **Gates 2 through 5:** Not yet open. Do not start.

**Awaken Engineer 1 with these two documents (in this order):**

1. `John/Locked_Gate_Table_v1.0.md` (this file) — situational awareness, 5 minutes.
2. `John/Engineer_1_Gate_1_Brief.md` — implementation guide, 15 minutes.

Engineer 1 should also read `John/Newsroom_Worker_Contract_v1.1.md` as the API spec while implementing. Halo Memo can be skipped at Gate 1.

---

## Change log

| Version | Date | Change | Approved by |
|---|---|---|---|
| v1.0 | 2026-04-25 | Initial lock. Gates 0–5 defined. Halo Memo v0.2 attached at Gate 2.5. | Architect |
| v1.0 | 2026-04-25 | Closing-line workflow ratified as project-level covenant applicable to Gates 1–5. See §Definition of Closed and §Cross-cutting rules. | Architect |
